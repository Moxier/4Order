begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_function(
  'public',
  'transition_kitchen_order_status',
  array['uuid', 'public.order_status', 'public.order_status'],
  'audited kitchen transition function exists'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.transition_kitchen_order_status(uuid,public.order_status,public.order_status)',
    'EXECUTE'
  ),
  'authenticated staff can execute the kitchen transition function'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.transition_kitchen_order_status(uuid,public.order_status,public.order_status)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute kitchen transitions'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ),
  'orders publish Realtime change signals'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_lines'
  ),
  'order lines publish Realtime change signals'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase3-kitchen@4order.local', now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase3-cashier@4order.local', now(), now()),
  ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'phase3-admin@4order.local', now(), now()),
  ('91000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'phase3-disabled@4order.local', now(), now());

insert into public.staff_profiles (user_id, display_name, role, enabled)
values
  ('91000000-0000-4000-8000-000000000001', 'Phase 3 Kitchen', 'KITCHEN', true),
  ('91000000-0000-4000-8000-000000000002', 'Phase 3 Cashier', 'CASHIER', true),
  ('91000000-0000-4000-8000-000000000003', 'Phase 3 Admin', 'ADMIN', true),
  ('91000000-0000-4000-8000-000000000004', 'Phase 3 Disabled', 'KITCHEN', false);

insert into public.table_sessions (id, table_id)
select '92000000-0000-4000-8000-000000000001', id
from public.restaurant_tables
where name = 'โต๊ะ 01';

insert into public.orders (
  id,
  session_id,
  original_text,
  idempotency_key,
  submission_table_token_hash
)
select
  source.id,
  '92000000-0000-4000-8000-000000000001',
  source.original_text,
  source.idempotency_key,
  encode(extensions.digest(restaurant_tables.public_token, 'sha256'), 'hex')
from public.restaurant_tables
cross join (
  values
    (
      '93000000-0000-4000-8000-000000000001'::uuid,
      'ข้าวหมกไก่ 1'::text,
      '94000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      '93000000-0000-4000-8000-000000000002'::uuid,
      'ซุปหางวัว 1'::text,
      '94000000-0000-4000-8000-000000000002'::uuid
    )
) as source(id, original_text, idempotency_key)
where restaurant_tables.name = 'โต๊ะ 01';

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*) from public.orders where session_id = '92000000-0000-4000-8000-000000000001'),
  2::bigint,
  'kitchen can read the authoritative order rows through RLS'
);

select is(
  (
    select status::text
    from public.transition_kitchen_order_status(
      '93000000-0000-4000-8000-000000000001',
      'NEW',
      'ACKNOWLEDGED'
    )
  ),
  'ACKNOWLEDGED',
  'kitchen can acknowledge a new order'
);

reset role;
select ok(
  (select acknowledged_at is not null from public.orders where id = '93000000-0000-4000-8000-000000000001'),
  'acknowledging records its authoritative timestamp'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where entity_id = '93000000-0000-4000-8000-000000000001'
      and action = 'KITCHEN_ORDER_STATUS_CHANGED'
  ),
  1::bigint,
  'the status transition creates one audit event'
);

select is(
  (
    select metadata ->> 'from_status'
    from public.audit_logs
    where entity_id = '93000000-0000-4000-8000-000000000001'
  ),
  'NEW',
  'the audit event records its source status'
);

select is(
  (
    select metadata ->> 'to_status'
    from public.audit_logs
    where entity_id = '93000000-0000-4000-8000-000000000001'
  ),
  'ACKNOWLEDGED',
  'the audit event records its target status'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$
    select *
    from public.transition_kitchen_order_status(
      '93000000-0000-4000-8000-000000000001',
      'ACKNOWLEDGED',
      'DONE'
    )
  $$,
  'P0001'::char(5),
  'kitchen_order_invalid_transition',
  'kitchen cannot skip the preparing state'
);

select throws_ok(
  $$
    update public.orders
    set status = 'PREPARING', preparing_at = now()
    where id = '93000000-0000-4000-8000-000000000001'
  $$,
  '42501'::char(5),
  null,
  'authenticated clients cannot bypass the transition function with UPDATE'
);

select is(
  (
    select status::text
    from public.transition_kitchen_order_status(
      '93000000-0000-4000-8000-000000000001',
      'ACKNOWLEDGED',
      'PREPARING'
    )
  ),
  'PREPARING',
  'acknowledged orders can move to preparing'
);

reset role;
select ok(
  (select preparing_at is not null from public.orders where id = '93000000-0000-4000-8000-000000000001'),
  'preparing records its authoritative timestamp'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select is(
  (
    select status::text
    from public.transition_kitchen_order_status(
      '93000000-0000-4000-8000-000000000001',
      'PREPARING',
      'DONE'
    )
  ),
  'DONE',
  'preparing orders can move to done'
);

reset role;
select ok(
  (select completed_at is not null from public.orders where id = '93000000-0000-4000-8000-000000000001'),
  'completion records its authoritative timestamp'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$
    select *
    from public.transition_kitchen_order_status(
      '93000000-0000-4000-8000-000000000001',
      'PREPARING',
      'DONE'
    )
  $$,
  'P0001'::char(5),
  'kitchen_order_status_conflict',
  'a stale device cannot repeat a transition from an obsolete expected status'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$
    select *
    from public.transition_kitchen_order_status(
      '93000000-0000-4000-8000-000000000002',
      'NEW',
      'ACKNOWLEDGED'
    )
  $$,
  'P0001'::char(5),
  'kitchen_order_forbidden',
  'cashier cannot perform kitchen workflow transitions'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
select is(
  (
    select status::text
    from public.transition_kitchen_order_status(
      '93000000-0000-4000-8000-000000000002',
      'NEW',
      'ACKNOWLEDGED'
    )
  ),
  'ACKNOWLEDGED',
  'admin can perform a kitchen workflow transition'
);

reset role;
update public.orders
set status = 'NEW', acknowledged_at = null
where id = '93000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$
    select *
    from public.transition_kitchen_order_status(
      '93000000-0000-4000-8000-000000000002',
      'NEW',
      'ACKNOWLEDGED'
    )
  $$,
  'P0001'::char(5),
  'kitchen_order_forbidden',
  'disabled kitchen staff cannot transition orders'
);

reset role;
select * from finish();
rollback;
