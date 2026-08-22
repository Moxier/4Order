-- Kitchen status changes must go through one audited transaction. Authenticated
-- clients retain SELECT access through RLS, but no longer receive direct UPDATE
-- privileges on orders.
revoke update on public.orders from authenticated;

create or replace function public.transition_kitchen_order_status(
  p_order_id uuid,
  p_expected_status public.order_status,
  p_target_status public.order_status
)
returns table (
  order_id uuid,
  status public.order_status,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  current_status public.order_status;
  changed_at timestamptz := statement_timestamp();
begin
  actor_id := (select auth.uid());

  if actor_id is null
    or not private.has_staff_role(array['KITCHEN', 'ADMIN']::public.staff_role[]) then
    raise exception using
      errcode = 'P0001',
      message = 'kitchen_order_forbidden';
  end if;

  if not (
    (p_expected_status = 'NEW' and p_target_status = 'ACKNOWLEDGED')
    or (p_expected_status = 'ACKNOWLEDGED' and p_target_status = 'PREPARING')
    or (p_expected_status = 'PREPARING' and p_target_status = 'DONE')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'kitchen_order_invalid_transition';
  end if;

  select orders.status
    into current_status
    from public.orders
    where orders.id = p_order_id
    for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'kitchen_order_not_found';
  end if;

  if current_status is distinct from p_expected_status then
    raise exception using
      errcode = 'P0001',
      message = 'kitchen_order_status_conflict';
  end if;

  update public.orders
  set
    status = p_target_status,
    acknowledged_at = case
      when p_target_status = 'ACKNOWLEDGED' then changed_at
      else orders.acknowledged_at
    end,
    preparing_at = case
      when p_target_status = 'PREPARING' then changed_at
      else orders.preparing_at
    end,
    completed_at = case
      when p_target_status = 'DONE' then changed_at
      else orders.completed_at
    end
  where orders.id = p_order_id;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor_id,
    'KITCHEN_ORDER_STATUS_CHANGED',
    'ORDER',
    p_order_id,
    jsonb_build_object(
      'from_status', p_expected_status,
      'to_status', p_target_status
    )
  );

  return query
    select orders.id, orders.status, orders.updated_at
    from public.orders
    where orders.id = p_order_id;
end;
$$;

revoke all on function public.transition_kitchen_order_status(
  uuid,
  public.order_status,
  public.order_status
) from public, anon, authenticated;
grant execute on function public.transition_kitchen_order_status(
  uuid,
  public.order_status,
  public.order_status
) to authenticated;

comment on function public.transition_kitchen_order_status(
  uuid,
  public.order_status,
  public.order_status
) is
  'Audited Phase 3 kitchen transition with role enforcement, expected-state conflict detection, and authoritative timestamps.';

-- Realtime events are refresh signals only. RLS still controls which rows an
-- authenticated subscriber can receive, and the client re-fetches the full
-- authoritative kitchen read model after every signal or reconnect.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_lines'
  ) then
    alter publication supabase_realtime add table public.order_lines;
  end if;
end;
$$;
