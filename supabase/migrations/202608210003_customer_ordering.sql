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
  target_table_id uuid;
  target_table_name text;
  active_session_id uuid;
  created_order_id uuid;
  created_order_number bigint;
  existing_table_id uuid;
  existing_order_number bigint;
  existing_original_text text;
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

  -- Serialize retries of the same client-generated key, including requests
  -- that arrive concurrently through different application instances.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0)
  );

  -- Lock the table row before looking up/creating the active session. Every
  -- future table-closing transaction must take this same row lock first.
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

  select
    table_sessions.table_id,
    orders.order_number,
    orders.original_text
    into existing_table_id, existing_order_number, existing_original_text
    from public.orders
    join public.table_sessions on table_sessions.id = orders.session_id
    where orders.idempotency_key = p_idempotency_key;

  if found then
    if existing_table_id is distinct from target_table_id
      or existing_original_text is distinct from p_original_text then
      raise exception using
        errcode = 'P0001',
        message = 'customer_order_idempotency_conflict';
    end if;

    return query
      select existing_order_number, target_table_name, true;
    return;
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
    idempotency_key
  )
  values (
    active_session_id,
    p_original_text,
    p_idempotency_key
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
  'Server-only Phase 2 entry point: resolves an enabled QR token, reuses or creates the active table session, preserves exact text, and returns idempotent order results.';
