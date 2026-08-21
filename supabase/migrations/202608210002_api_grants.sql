-- Supabase API roles still require SQL privileges in addition to RLS policies.
-- Public customer mutations use service_role from server-only code; browsers
-- never receive this role or key.
grant usage on schema public to authenticated, service_role;

grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update on tables to authenticated;
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;

-- Replace broad FOR ALL policies with explicit INSERT/UPDATE policies. V1
-- operational and financial records are status-managed and never hard-deleted.
drop policy restaurant_tables_admin_write on public.restaurant_tables;
create policy restaurant_tables_admin_insert
on public.restaurant_tables for insert to authenticated
with check ((select private.has_staff_role(array['ADMIN']::public.staff_role[])));
create policy restaurant_tables_admin_update
on public.restaurant_tables for update to authenticated
using ((select private.has_staff_role(array['ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['ADMIN']::public.staff_role[])));

drop policy table_sessions_cashier_write on public.table_sessions;
create policy table_sessions_cashier_insert
on public.table_sessions for insert to authenticated
with check ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])));
create policy table_sessions_cashier_update
on public.table_sessions for update to authenticated
using ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])));

drop policy payments_cashier_write on public.payments;
create policy payments_cashier_insert
on public.payments for insert to authenticated
with check ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])));
create policy payments_cashier_update
on public.payments for update to authenticated
using ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['CASHIER', 'ADMIN']::public.staff_role[])));

drop policy print_jobs_staff_write on public.print_jobs;
create policy print_jobs_staff_insert
on public.print_jobs for insert to authenticated
with check ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));
create policy print_jobs_staff_update
on public.print_jobs for update to authenticated
using ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])))
with check ((select private.has_staff_role(array['KITCHEN', 'CASHIER', 'ADMIN']::public.staff_role[])));
