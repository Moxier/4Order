create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create type public.staff_role as enum ('KITCHEN', 'CASHIER', 'ADMIN');
create type public.table_session_status as enum ('ACTIVE', 'CLOSED');
create type public.order_status as enum (
  'NEW',
  'ACKNOWLEDGED',
  'PREPARING',
  'DONE',
  'CANCELLED'
);
create type public.service_request_type as enum (
  'CALL_STAFF',
  'REQUEST_BILL',
  'URGENT_ASSISTANCE'
);
create type public.service_request_status as enum (
  'NEW',
  'ACKNOWLEDGED',
  'RESOLVED',
  'CANCELLED'
);
create type public.feedback_type as enum ('FOOD', 'SERVICE', 'CLEANLINESS', 'GENERAL');
create type public.feedback_severity as enum ('FEEDBACK', 'ISSUE', 'NEEDS_ASSISTANCE');
create type public.feedback_status as enum ('NEW', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');
create type public.payment_method as enum ('CASH', 'PROMPTPAY', 'OTHER');
create type public.payment_status as enum ('PENDING', 'COMPLETED', 'VOIDED');
create type public.print_job_type as enum ('KITCHEN_TICKET', 'BILL', 'TEST');
create type public.print_job_status as enum ('PENDING', 'PROCESSING', 'PRINTED', 'FAILED', 'CANCELLED');

create sequence public.order_number_seq as bigint start with 1000;

create or replace function private.generate_table_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select 't_' || translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_');
$$;

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  role public.staff_role not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_tables (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 80),
  public_token text not null unique default private.generate_table_token(),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_tables_public_token_format
    check (public_token ~ '^t_[A-Za-z0-9_-]{20,}$')
);

create table public.table_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  table_id uuid not null references public.restaurant_tables(id),
  status public.table_session_status not null default 'ACTIVE',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_sessions_closed_state check (
    (status = 'ACTIVE' and closed_at is null and closed_by is null)
    or (status = 'CLOSED' and closed_at is not null and closed_by is not null)
  ),
  constraint table_sessions_time_order check (closed_at is null or closed_at >= opened_at)
);

create unique index table_sessions_one_active_per_table
  on public.table_sessions(table_id)
  where status = 'ACTIVE';
create index table_sessions_table_opened_idx
  on public.table_sessions(table_id, opened_at desc);

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  order_number bigint not null unique default nextval('public.order_number_seq'),
  session_id uuid not null references public.table_sessions(id),
  status public.order_status not null default 'NEW',
  original_text text not null,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  preparing_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint orders_original_text_size
    check (char_length(original_text) between 1 and 8000)
);

create index orders_session_created_idx on public.orders(session_id, created_at);
create index orders_kitchen_status_created_idx on public.orders(status, created_at)
  where status in ('NEW', 'ACKNOWLEDGED', 'PREPARING');

create table public.order_lines (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  line_number integer not null check (line_number > 0),
  original_text text not null,
  price_amount bigint,
  priced_by uuid references auth.users(id) on delete restrict,
  priced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, line_number),
  unique (id, order_id),
  constraint order_lines_original_text_size
    check (char_length(original_text) between 1 and 1000),
  constraint order_lines_nonnegative_price
    check (price_amount is null or price_amount >= 0),
  constraint order_lines_pricing_metadata check (
    (price_amount is null and priced_by is null and priced_at is null)
    or (price_amount is not null and priced_by is not null and priced_at is not null)
  )
);

create index order_lines_order_idx on public.order_lines(order_id, line_number);

create table public.service_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id),
  type public.service_request_type not null,
  status public.service_request_status not null default 'NEW',
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index service_requests_active_idx on public.service_requests(status, created_at)
  where status in ('NEW', 'ACKNOWLEDGED');
create index service_requests_session_idx on public.service_requests(session_id, created_at);

create table public.feedback (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id),
  order_id uuid references public.orders(id),
  order_line_id uuid,
  type public.feedback_type not null,
  severity public.feedback_severity not null default 'FEEDBACK',
  message text not null,
  status public.feedback_status not null default 'NEW',
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint feedback_message_size check (char_length(btrim(message)) between 1 and 2000),
  constraint feedback_line_requires_order check (order_line_id is null or order_id is not null),
  constraint feedback_food_target check (
    (order_id is null and order_line_id is null)
    or type = 'FOOD'
  ),
  foreign key (order_line_id, order_id)
    references public.order_lines(id, order_id)
);

create index feedback_session_created_idx on public.feedback(session_id, created_at);
create index feedback_status_created_idx on public.feedback(status, created_at);

create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id),
  amount bigint not null check (amount >= 0),
  method public.payment_method not null,
  amount_received bigint,
  change_amount bigint,
  status public.payment_status not null default 'PENDING',
  idempotency_key uuid not null unique,
  paid_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_cash_amounts check (
    (method = 'CASH'
      and amount_received is not null
      and change_amount is not null
      and amount_received >= amount
      and change_amount = amount_received - amount)
    or (method <> 'CASH' and amount_received is null and change_amount is null)
  ),
  constraint payments_nonnegative_cash_values check (
    (amount_received is null or amount_received >= 0)
    and (change_amount is null or change_amount >= 0)
  ),
  constraint payments_completed_timestamp check (
    (status = 'COMPLETED' and paid_at is not null)
    or (status <> 'COMPLETED' and paid_at is null)
  )
);

create unique index payments_one_completed_per_session
  on public.payments(session_id)
  where status = 'COMPLETED';
create index payments_session_created_idx on public.payments(session_id, created_at);

create table public.print_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid references public.table_sessions(id),
  order_id uuid references public.orders(id),
  type public.print_job_type not null,
  printer text,
  payload jsonb not null default '{}'::jsonb,
  status public.print_job_status not null default 'PENDING',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  printed_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint print_jobs_target check (
    (type = 'KITCHEN_TICKET' and order_id is not null and session_id is not null)
    or (type = 'BILL' and session_id is not null)
    or type = 'TEST'
  )
);

create index print_jobs_pending_idx on public.print_jobs(status, created_at)
  where status in ('PENDING', 'FAILED');

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete restrict,
  action text not null check (char_length(btrim(action)) between 1 and 100),
  entity_type text not null check (char_length(btrim(entity_type)) between 1 and 100),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx
  on public.audit_logs(entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx
  on public.audit_logs(actor_user_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger staff_profiles_set_updated_at
before update on public.staff_profiles
for each row execute function private.set_updated_at();
create trigger restaurant_tables_set_updated_at
before update on public.restaurant_tables
for each row execute function private.set_updated_at();
create trigger table_sessions_set_updated_at
before update on public.table_sessions
for each row execute function private.set_updated_at();
create trigger orders_set_updated_at
before update on public.orders
for each row execute function private.set_updated_at();
create trigger order_lines_set_updated_at
before update on public.order_lines
for each row execute function private.set_updated_at();
create trigger service_requests_set_updated_at
before update on public.service_requests
for each row execute function private.set_updated_at();
create trigger feedback_set_updated_at
before update on public.feedback
for each row execute function private.set_updated_at();
create trigger payments_set_updated_at
before update on public.payments
for each row execute function private.set_updated_at();
create trigger print_jobs_set_updated_at
before update on public.print_jobs
for each row execute function private.set_updated_at();

create or replace function private.preserve_customer_order_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.original_text is distinct from old.original_text
    or new.session_id is distinct from old.session_id
    or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'customer order source fields are immutable';
  end if;
  return new;
end;
$$;

create trigger orders_preserve_customer_text
before update on public.orders
for each row execute function private.preserve_customer_order_text();

create or replace function private.preserve_customer_line_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.original_text is distinct from old.original_text
    or new.order_id is distinct from old.order_id
    or new.line_number is distinct from old.line_number then
    raise exception 'customer order line source fields are immutable';
  end if;
  return new;
end;
$$;

create trigger order_lines_preserve_customer_text
before update on public.order_lines
for each row execute function private.preserve_customer_line_text();

create or replace function private.validate_feedback_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_session_id uuid;
begin
  if new.order_id is null then
    return new;
  end if;

  select orders.session_id
    into target_session_id
    from public.orders
    where orders.id = new.order_id;

  if target_session_id is distinct from new.session_id then
    raise exception 'feedback target must belong to the same table session';
  end if;

  return new;
end;
$$;

create trigger feedback_validate_scope
before insert or update on public.feedback
for each row execute function private.validate_feedback_scope();

create or replace function private.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select staff_profiles.role
  from public.staff_profiles
  where staff_profiles.user_id = (select auth.uid())
    and staff_profiles.enabled = true;
$$;

create or replace function private.has_staff_role(allowed_roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_staff_role() = any(allowed_roles), false);
$$;

alter table public.staff_profiles enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.table_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.service_requests enable row level security;
alter table public.feedback enable row level security;
alter table public.payments enable row level security;
alter table public.print_jobs enable row level security;
alter table public.audit_logs enable row level security;

create policy staff_profiles_read_self_or_admin
on public.staff_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_staff_role(array['ADMIN']::public.staff_role[]))
);

create policy staff_profiles_admin_insert
on public.staff_profiles for insert to authenticated
with check ((select private.has_staff_role(array['ADMIN']::public.staff_role[])));
create policy staff_profiles_admin_update
on public.staff_profiles for update to authenticated
using ((select private.has_staff_role(array['ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['ADMIN']::public.staff_role[])));

create policy restaurant_tables_staff_read
on public.restaurant_tables for select to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));
create policy restaurant_tables_admin_write
on public.restaurant_tables for all to authenticated
using ((select private.has_staff_role(array['ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['ADMIN']::public.staff_role[])));

create policy table_sessions_staff_read
on public.table_sessions for select to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));
create policy table_sessions_cashier_write
on public.table_sessions for all to authenticated
using ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])));

create policy orders_staff_read
on public.orders for select to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));
create policy orders_staff_update
on public.orders for update to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));

create policy order_lines_staff_read
on public.order_lines for select to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));
create policy order_lines_cashier_update
on public.order_lines for update to authenticated
using ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])));

create policy service_requests_staff_read
on public.service_requests for select to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));
create policy service_requests_staff_update
on public.service_requests for update to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));

create policy feedback_staff_read
on public.feedback for select to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));
create policy feedback_staff_update
on public.feedback for update to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));

create policy payments_cashier_read
on public.payments for select to authenticated
using ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])));
create policy payments_cashier_write
on public.payments for all to authenticated
using ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])));

create policy print_jobs_staff_read
on public.print_jobs for select to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));
create policy print_jobs_staff_write
on public.print_jobs for all to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));

create policy audit_logs_admin_read
on public.audit_logs for select to authenticated
using ((select private.has_staff_role(array['ADMIN']::public.staff_role[])));

revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.current_staff_role() to authenticated;
grant execute on function private.has_staff_role(public.staff_role[]) to authenticated;

comment on column public.restaurant_tables.public_token is
  'Random revocable token used in public QR URLs; never expose the table UUID.';
comment on column public.orders.original_text is
  'Exact customer-submitted multiline text. Immutable after insert.';
comment on column public.order_lines.original_text is
  'Exact customer-submitted line. Immutable after insert.';
comment on column public.order_lines.price_amount is 'Cashier-entered total for this line, in satang.';
comment on column public.payments.amount is 'Payment total in satang.';
comment on table public.print_jobs is
  'Durable printer-neutral seam for a future print adapter or local print agent.';
