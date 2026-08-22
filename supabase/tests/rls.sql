begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-kitchen@4order.local', now(), now()),
  ('81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-cashier@4order.local', now(), now()),
  ('81000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rls-admin@4order.local', now(), now()),
  ('81000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'rls-disabled@4order.local', now(), now());

insert into public.staff_profiles (user_id, display_name, role, enabled)
values
  ('81000000-0000-4000-8000-000000000001', 'RLS Kitchen', 'KITCHEN', true),
  ('81000000-0000-4000-8000-000000000002', 'RLS Cashier', 'CASHIER', true),
  ('81000000-0000-4000-8000-000000000003', 'RLS Admin', 'ADMIN', true),
  ('81000000-0000-4000-8000-000000000004', 'RLS Disabled', 'KITCHEN', false);

insert into public.table_sessions (id, table_id)
select '82000000-0000-4000-8000-000000000001', id
from public.restaurant_tables
where name = 'โต๊ะ 02';

insert into public.orders (
  id,
  session_id,
  original_text,
  idempotency_key,
  submission_table_token_hash
)
select
  '83000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'ข้าวหมกไก่ 1',
  '84000000-0000-4000-8000-000000000001',
  encode(extensions.digest(restaurant_tables.public_token, 'sha256'), 'hex')
from public.restaurant_tables
where name = 'โต๊ะ 02';

insert into public.order_lines (id, order_id, line_number, original_text)
values (
  '85000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  1,
  'ข้าวหมกไก่ 1'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*) from public.orders where id = '83000000-0000-4000-8000-000000000001'),
  1::bigint,
  'kitchen can read customer orders through RLS'
);

select is(
  (
    select status::text
    from public.transition_kitchen_order_status(
      '83000000-0000-4000-8000-000000000001',
      'NEW',
      'ACKNOWLEDGED'
    )
  ),
  'ACKNOWLEDGED',
  'kitchen can update operational order state through the audited function'
);

select throws_ok(
  $$ update public.orders set order_number = order_number + 1 where id = '83000000-0000-4000-8000-000000000001' $$,
  '42501'::char(5),
  null,
  'kitchen cannot update the stable order number'
);

update public.order_lines
set price_amount = 1000,
    priced_by = '81000000-0000-4000-8000-000000000001',
    priced_at = now()
where id = '85000000-0000-4000-8000-000000000001';

reset role;
select is(
  (select price_amount from public.order_lines where id = '85000000-0000-4000-8000-000000000001'),
  null::bigint,
  'kitchen RLS cannot price an order line'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);

update public.order_lines
set price_amount = 12000,
    priced_by = '81000000-0000-4000-8000-000000000002',
    priced_at = now()
where id = '85000000-0000-4000-8000-000000000001';

select is(
  (select price_amount from public.order_lines where id = '85000000-0000-4000-8000-000000000001'),
  12000::bigint,
  'cashier can update line pricing through RLS'
);

select throws_ok(
  $$ update public.order_lines set original_text = 'changed' where id = '85000000-0000-4000-8000-000000000001' $$,
  '42501'::char(5),
  null,
  'cashier cannot update customer line text'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);

select is(
  (select count(*) from public.orders where id = '83000000-0000-4000-8000-000000000001'),
  1::bigint,
  'admin can read customer orders through RLS'
);

select throws_ok(
  $$ update public.orders set order_number = order_number + 1 where id = '83000000-0000-4000-8000-000000000001' $$,
  '42501'::char(5),
  null,
  'admin also cannot update the stable order number'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);

select is(
  (select count(*) from public.orders),
  0::bigint,
  'a disabled staff profile has no order access'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.orders $$,
  '42501'::char(5),
  null,
  'anonymous callers cannot read orders directly'
);

reset role;
select * from finish();
rollback;
