begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_function(
  'public',
  'submit_customer_order',
  array['text', 'text', 'uuid'],
  'transaction-safe customer-order function exists'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.submit_customer_order(text,text,uuid)',
    'EXECUTE'
  ),
  'server-only service role can submit customer orders'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.submit_customer_order(text,text,uuid)',
    'EXECUTE'
  ),
  'anonymous Data API callers cannot execute the order function directly'
);

create temporary table first_order_result as
select *
from public.submit_customer_order(
  (select public_token from public.restaurant_tables where name = 'โต๊ะ 03'),
  E'ข้าวหมกไก่ 2  \n\n กะเพราเนื้อ 1 เผ็ดน้อย',
  '61000000-0000-0000-0000-000000000001'
);

select is(
  (select table_name from first_order_result),
  'โต๊ะ 03',
  'submission resolves the table from its public token'
);

select is(
  (select is_duplicate from first_order_result),
  false,
  'the first submission is not marked as a retry'
);

select is(
  (
    select count(*)
    from public.orders
    where idempotency_key = '61000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'the first submission creates one order'
);

select is(
  (
    select original_text
    from public.orders
    where idempotency_key = '61000000-0000-0000-0000-000000000001'
  ),
  E'ข้าวหมกไก่ 2  \n\n กะเพราเนื้อ 1 เผ็ดน้อย',
  'the complete customer text is preserved exactly'
);

select is(
  (
    select count(*)
    from public.order_lines
    join public.orders on orders.id = order_lines.order_id
    where orders.idempotency_key = '61000000-0000-0000-0000-000000000001'
  ),
  2::bigint,
  'blank lines are omitted from operational order lines'
);

select results_eq(
  $$
    select order_lines.line_number, order_lines.original_text
    from public.order_lines
    join public.orders on orders.id = order_lines.order_id
    where orders.idempotency_key = '61000000-0000-0000-0000-000000000001'
    order by order_lines.line_number
  $$,
  $$ values
    (1, 'ข้าวหมกไก่ 2  '::text),
    (3, ' กะเพราเนื้อ 1 เผ็ดน้อย'::text)
  $$,
  'nonblank line text and original line positions are preserved'
);

create temporary table retry_result as
select *
from public.submit_customer_order(
  (select public_token from public.restaurant_tables where name = 'โต๊ะ 03'),
  E'ข้าวหมกไก่ 2  \n\n กะเพราเนื้อ 1 เผ็ดน้อย',
  '61000000-0000-0000-0000-000000000001'
);

select is(
  (select order_number from retry_result),
  (select order_number from first_order_result),
  'a retry returns the original order number'
);

select is(
  (select is_duplicate from retry_result),
  true,
  'a retry is explicitly marked as duplicate-safe'
);

select is(
  (
    select count(*)
    from public.orders
    where idempotency_key = '61000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'retrying does not insert another order'
);

select throws_ok(
  $$
    select *
    from public.submit_customer_order(
      (select public_token from public.restaurant_tables where name = 'โต๊ะ 03'),
      'ข้อความเปลี่ยนหลังส่ง',
      '61000000-0000-0000-0000-000000000001'
    )
  $$,
  'P0001'::char(5),
  'customer_order_idempotency_conflict',
  'one idempotency key cannot be reused for different text'
);

do $$
begin
  perform public.submit_customer_order(
    (select public_token from public.restaurant_tables where name = 'โต๊ะ 03'),
    'น้ำเปล่า 2',
    '61000000-0000-0000-0000-000000000002'
  );
end;
$$;

select is(
  (
    select count(distinct table_sessions.id)
    from public.table_sessions
    join public.orders on orders.session_id = table_sessions.id
    join public.restaurant_tables on restaurant_tables.id = table_sessions.table_id
    where restaurant_tables.name = 'โต๊ะ 03'
  ),
  1::bigint,
  'additional orders reuse the active table session'
);

select is(
  (
    select count(*)
    from public.orders
    join public.table_sessions on table_sessions.id = orders.session_id
    join public.restaurant_tables on restaurant_tables.id = table_sessions.table_id
    where restaurant_tables.name = 'โต๊ะ 03'
  ),
  2::bigint,
  'the active session contains both customer orders'
);

update public.restaurant_tables set enabled = false where name = 'โต๊ะ 04';

select throws_ok(
  $$
    select *
    from public.submit_customer_order(
      (select public_token from public.restaurant_tables where name = 'โต๊ะ 04'),
      'ข้าวมันไก่ 1',
      '61000000-0000-0000-0000-000000000003'
    )
  $$,
  'P0001'::char(5),
  'customer_order_invalid_table',
  'disabled tables reject public submissions'
);

select throws_ok(
  $$
    select *
    from public.submit_customer_order(
      'not-a-table-token',
      'ข้าวมันไก่ 1',
      '61000000-0000-0000-0000-000000000004'
    )
  $$,
  'P0001'::char(5),
  'customer_order_invalid_table',
  'malformed table tokens are rejected'
);

select throws_ok(
  $$
    select *
    from public.submit_customer_order(
      (select public_token from public.restaurant_tables where name = 'โต๊ะ 05'),
      E' \n\t ',
      '61000000-0000-0000-0000-000000000005'
    )
  $$,
  'P0001'::char(5),
  'customer_order_invalid_text',
  'blank-only customer text is rejected'
);

select throws_ok(
  $$
    select *
    from public.submit_customer_order(
      (select public_token from public.restaurant_tables where name = 'โต๊ะ 05'),
      repeat('ก', 1001),
      '61000000-0000-0000-0000-000000000006'
    )
  $$,
  'P0001'::char(5),
  'customer_order_line_too_long',
  'overlong individual order lines are rejected'
);

do $$
declare
  rate_key uuid;
begin
  foreach rate_key in array array[
    '62000000-0000-0000-0000-000000000001'::uuid,
    '62000000-0000-0000-0000-000000000002'::uuid,
    '62000000-0000-0000-0000-000000000003'::uuid,
    '62000000-0000-0000-0000-000000000004'::uuid,
    '62000000-0000-0000-0000-000000000005'::uuid
  ]
  loop
    perform public.submit_customer_order(
      (select public_token from public.restaurant_tables where name = 'โต๊ะ 05'),
      'น้ำเปล่า 1',
      rate_key
    );
  end loop;
end;
$$;

select throws_ok(
  $$
    select *
    from public.submit_customer_order(
      (select public_token from public.restaurant_tables where name = 'โต๊ะ 05'),
      'น้ำเปล่า 1',
      '62000000-0000-0000-0000-000000000006'
    )
  $$,
  'P0001'::char(5),
  'customer_order_rate_limited',
  'the sixth new order within one minute is rate limited'
);

select is(
  (
    select count(*)
    from public.orders
    join public.table_sessions on table_sessions.id = orders.session_id
    join public.restaurant_tables on restaurant_tables.id = table_sessions.table_id
    where restaurant_tables.name = 'โต๊ะ 05'
  ),
  5::bigint,
  'rate limiting does not insert the rejected order'
);

select * from finish();
rollback;
