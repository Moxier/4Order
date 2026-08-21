begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_table('public', 'staff_profiles', 'staff_profiles exists');
select has_table('public', 'restaurant_tables', 'restaurant_tables exists');
select has_table('public', 'table_sessions', 'table_sessions exists');
select has_table('public', 'orders', 'orders exists');
select has_table('public', 'order_lines', 'order_lines exists');
select has_table('public', 'service_requests', 'service_requests exists');
select has_table('public', 'feedback', 'feedback exists');
select has_table('public', 'payments', 'payments exists');
select has_table('public', 'print_jobs', 'print_jobs exists');
select has_table('public', 'audit_logs', 'audit_logs exists');

select has_index(
  'public',
  'table_sessions',
  'table_sessions_one_active_per_table',
  'one-active-session index exists'
);

select col_type_is('public', 'order_lines', 'price_amount', 'bigint', 'line price uses integer satang');
select col_type_is('public', 'payments', 'amount', 'bigint', 'payment total uses integer satang');
select col_type_is('public', 'payments', 'amount_received', 'bigint', 'cash received uses integer satang');
select col_type_is('public', 'payments', 'change_amount', 'bigint', 'change uses integer satang');

select has_trigger(
  'public',
  'orders',
  'orders_preserve_customer_text',
  'order source text is protected'
);
select has_trigger(
  'public',
  'order_lines',
  'order_lines_preserve_customer_text',
  'order-line source text is protected'
);

select is(
  (select count(*) from public.restaurant_tables where name like 'โต๊ะ %'),
  5::bigint,
  'seed creates exactly five Thai demo tables'
);
select is(
  (select count(*) from public.restaurant_tables where public_token !~ '^t_[A-Za-z0-9_-]{20,}$'),
  0::bigint,
  'all seeded table tokens are opaque and URL-safe'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_class
    join pg_catalog.pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = any(array[
        'staff_profiles',
        'restaurant_tables',
        'table_sessions',
        'orders',
        'order_lines',
        'service_requests',
        'feedback',
        'payments',
        'print_jobs',
        'audit_logs'
      ])
      and pg_class.relrowsecurity
  ),
  10::bigint,
  'RLS is enabled on every application table'
);

select ok(
  not pg_catalog.has_table_privilege('anon', 'public.restaurant_tables', 'SELECT'),
  'anonymous Data API callers have no table-listing privilege'
);
select ok(
  pg_catalog.has_table_privilege('service_role', 'public.staff_profiles', 'INSERT'),
  'server-only service role can provision staff profiles'
);
select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.table_sessions', 'DELETE'),
  'authenticated staff receive no hard-delete privilege'
);

insert into public.table_sessions (id, table_id)
select '10000000-0000-0000-0000-000000000001', id
from public.restaurant_tables
where name = 'โต๊ะ 01';

select throws_ok(
  $$
    insert into public.table_sessions (table_id)
    select id from public.restaurant_tables where name = 'โต๊ะ 01'
  $$,
  '23505'::char(5),
  null,
  'a table cannot have two active sessions'
);

insert into public.table_sessions (id, table_id)
select '10000000-0000-0000-0000-000000000002', id
from public.restaurant_tables
where name = 'โต๊ะ 02';

insert into public.orders (
  id,
  session_id,
  original_text,
  idempotency_key
)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  E'ข้าวหมกไก่ 2\nซุปหางวัว 1',
  '30000000-0000-0000-0000-000000000001'
);

insert into public.order_lines (
  id,
  order_id,
  line_number,
  original_text
)
values (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  1,
  'ข้าวหมกไก่ 2'
);

select throws_ok(
  $$
    update public.order_lines
    set price_amount = -1
    where id = '40000000-0000-0000-0000-000000000001'
  $$,
  '23514'::char(5),
  null,
  'negative line prices are rejected'
);

select throws_ok(
  $$
    update public.orders
    set original_text = 'changed'
    where id = '20000000-0000-0000-0000-000000000001'
  $$,
  'P0001'::char(5),
  'customer order source fields are immutable',
  'customer order source text cannot be overwritten'
);

select throws_ok(
  $$
    update public.order_lines
    set original_text = 'changed'
    where id = '40000000-0000-0000-0000-000000000001'
  $$,
  'P0001'::char(5),
  'customer order line source fields are immutable',
  'customer order-line source text cannot be overwritten'
);

select throws_ok(
  $$
    insert into public.feedback (
      session_id,
      order_id,
      type,
      message,
      idempotency_key
    )
    values (
      '10000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      'FOOD',
      'wrong session',
      '50000000-0000-0000-0000-000000000001'
    )
  $$,
  'P0001'::char(5),
  'feedback target must belong to the same table session',
  'feedback cannot reference a previous or different table session'
);

select * from finish();
rollback;
