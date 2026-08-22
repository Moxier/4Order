-- Preserve the QR token used for an accepted order without retaining another
-- plaintext copy of a revocable public credential. This lets an ambiguous
-- client retry recover its committed receipt after the table QR is rotated or
-- disabled, while new submissions still require the current enabled token.
alter table public.orders
  add column submission_table_token_hash text;

update public.orders
set submission_table_token_hash = encode(
  extensions.digest(restaurant_tables.public_token, 'sha256'),
  'hex'
)
from public.table_sessions
join public.restaurant_tables
  on restaurant_tables.id = table_sessions.table_id
where table_sessions.id = orders.session_id;

alter table public.orders
  alter column submission_table_token_hash set not null,
  add constraint orders_submission_table_token_hash_format
    check (submission_table_token_hash ~ '^[0-9a-f]{64}$');

comment on column public.orders.submission_table_token_hash is
  'SHA-256 fingerprint of the QR token used for the accepted request. Immutable and used only to authenticate idempotent retries after QR rotation or disable.';

-- Phase 2 source and receipt fields never change after insert. Keep this
-- trigger as defense in depth for privileged writers in addition to the
-- authenticated column grants below.
create or replace function private.preserve_customer_order_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.order_number is distinct from old.order_number
    or new.session_id is distinct from old.session_id
    or new.original_text is distinct from old.original_text
    or new.idempotency_key is distinct from old.idempotency_key
    or new.submission_table_token_hash is distinct from old.submission_table_token_hash
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = 'P0001',
      message = 'customer order source fields are immutable';
  end if;
  return new;
end;
$$;

create or replace function private.preserve_customer_line_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.original_text is distinct from old.original_text
    or new.order_id is distinct from old.order_id
    or new.line_number is distinct from old.line_number
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = 'P0001',
      message = 'customer order line source fields are immutable';
  end if;
  return new;
end;
$$;

-- Remove broad table-level UPDATE privileges. RLS still decides which rows a
-- staff role may reach; these grants independently decide which columns an
-- authenticated request may attempt to change.
revoke update on public.orders from authenticated;
grant update (
  status,
  acknowledged_at,
  preparing_at,
  completed_at,
  cancelled_at
) on public.orders to authenticated;

revoke update on public.order_lines from authenticated;
grant update (
  price_amount,
  priced_by,
  priced_at
) on public.order_lines to authenticated;

create or replace function public.submit_customer_order(
  p_table_token text,
  p_original_text text,
  p_idempotency_key uuid
)
returns table (
  order_number bigint,
  table_name text,
  is_duplicate boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  requested_token_hash text;
  target_table_id uuid;
  target_table_name text;
  active_session_id uuid;
  created_order_id uuid;
  created_order_number bigint;
  existing_order_number bigint;
  existing_original_text text;
  existing_token_hash text;
  existing_table_name text;
  recent_order_count integer;
begin
  if p_table_token is null
    or p_table_token !~ '^t_[A-Za-z0-9_-]{20,}$' then
    raise exception using
      errcode = 'P0001',
      message = 'customer_order_invalid_table';
  end if;

  if p_idempotency_key is null then
    raise exception using
      errcode = 'P0001',
      message = 'customer_order_invalid_idempotency_key';
  end if;

  if p_original_text is null
    or char_length(p_original_text) > 8000
    or p_original_text !~ '[^[:space:]]' then
    raise exception using
      errcode = 'P0001',
      message = 'customer_order_invalid_text';
  end if;

  if exists (
    select 1
    from regexp_split_to_table(p_original_text, E'\n') as source(line_text)
    where source.line_text ~ '[^[:space:]]'
      and char_length(source.line_text) > 1000
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'customer_order_line_too_long';
  end if;

  requested_token_hash := encode(
    extensions.digest(p_table_token, 'sha256'),
    'hex'
  );

  -- Serialize every use of the same client-generated key across application
  -- instances. The duplicate lookup intentionally precedes current-token
  -- validation so an already-committed request remains recoverable.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0)
  );

  select
    orders.order_number,
    orders.original_text,
    orders.submission_table_token_hash,
    restaurant_tables.name
    into
      existing_order_number,
      existing_original_text,
      existing_token_hash,
      existing_table_name
    from public.orders
    join public.table_sessions
      on table_sessions.id = orders.session_id
    join public.restaurant_tables
      on restaurant_tables.id = table_sessions.table_id
    where orders.idempotency_key = p_idempotency_key;

  if found then
    if existing_original_text is distinct from p_original_text
      or existing_token_hash is distinct from requested_token_hash then
      raise exception using
        errcode = 'P0001',
        message = 'customer_order_idempotency_conflict';
    end if;

    return query
      select existing_order_number, existing_table_name, true;
    return;
  end if;

  -- New submissions must always resolve the current enabled QR token.
  select restaurant_tables.id, restaurant_tables.name
    into target_table_id, target_table_name
    from public.restaurant_tables
    where restaurant_tables.public_token = p_table_token
      and restaurant_tables.enabled = true
    for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'customer_order_invalid_table';
  end if;

  select count(*)::integer
    into recent_order_count
    from public.orders
    join public.table_sessions on table_sessions.id = orders.session_id
    where table_sessions.table_id = target_table_id
      and orders.created_at >= now() - interval '1 minute';

  if recent_order_count >= 5 then
    raise exception using
      errcode = 'P0001',
      message = 'customer_order_rate_limited';
  end if;

  select table_sessions.id
    into active_session_id
    from public.table_sessions
    where table_sessions.table_id = target_table_id
      and table_sessions.status = 'ACTIVE';

  if active_session_id is null then
    insert into public.table_sessions (table_id)
    values (target_table_id)
    returning id into active_session_id;
  end if;

  insert into public.orders (
    session_id,
    original_text,
    idempotency_key,
    submission_table_token_hash
  )
  values (
    active_session_id,
    p_original_text,
    p_idempotency_key,
    requested_token_hash
  )
  returning id, orders.order_number
    into created_order_id, created_order_number;

  insert into public.order_lines (
    order_id,
    line_number,
    original_text
  )
  select
    created_order_id,
    source.line_number::integer,
    source.line_text
  from regexp_split_to_table(p_original_text, E'\n')
    with ordinality as source(line_text, line_number)
  where source.line_text ~ '[^[:space:]]';

  return query
    select created_order_number, target_table_name, false;
end;
$$;

revoke all on function public.submit_customer_order(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_customer_order(text, text, uuid)
  to service_role;

comment on function public.submit_customer_order(text, text, uuid) is
  'Server-only Phase 2 entry point with byte-safe application validation, immutable receipt fields, concurrent idempotency, and retry recovery after QR rotation or disable.';
