-- ============================================================================
-- ATS SAAS · Fase 1 · Row Level Security (deny-by-default)
-- Roles: admin (todo) · operador (leer y escribir) · lector (solo leer)
-- ============================================================================

-- Función auxiliar: rol del usuario autenticado actual.
-- security definer + search_path fijo para evitar recursión de RLS y
-- suplantación de esquema.
create function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- --- profiles ------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.current_user_role() = 'admin');

create policy "profiles_update_admin_only"
  on public.profiles for update
  using (public.current_user_role() = 'admin');

-- --- clientes / operadores / categorias_costo (catálogos) ----------------
alter table public.clientes enable row level security;
alter table public.operadores enable row level security;
alter table public.categorias_costo enable row level security;

create policy "clientes_select_authenticated"
  on public.clientes for select
  using (auth.uid() is not null);

create policy "clientes_write_admin_operador"
  on public.clientes for all
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "operadores_select_authenticated"
  on public.operadores for select
  using (auth.uid() is not null);

create policy "operadores_write_admin_operador"
  on public.operadores for all
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "categorias_costo_select_authenticated"
  on public.categorias_costo for select
  using (auth.uid() is not null);

create policy "categorias_costo_write_admin_operador"
  on public.categorias_costo for all
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

-- --- ventas_servicios ------------------------------------------------------
alter table public.ventas_servicios enable row level security;

create policy "ventas_select_authenticated"
  on public.ventas_servicios for select
  using (auth.uid() is not null);

create policy "ventas_insert_admin_operador"
  on public.ventas_servicios for insert
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "ventas_update_admin_operador"
  on public.ventas_servicios for update
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "ventas_delete_admin_only"
  on public.ventas_servicios for delete
  using (public.current_user_role() = 'admin');

-- --- gastos_operacionales ---------------------------------------------------
alter table public.gastos_operacionales enable row level security;

create policy "gastos_op_select_authenticated"
  on public.gastos_operacionales for select
  using (auth.uid() is not null);

create policy "gastos_op_insert_admin_operador"
  on public.gastos_operacionales for insert
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "gastos_op_update_admin_operador"
  on public.gastos_operacionales for update
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "gastos_op_delete_admin_only"
  on public.gastos_operacionales for delete
  using (public.current_user_role() = 'admin');

-- --- gastos_administrativos --------------------------------------------------
alter table public.gastos_administrativos enable row level security;

create policy "gastos_admin_select_authenticated"
  on public.gastos_administrativos for select
  using (auth.uid() is not null);

create policy "gastos_admin_insert_admin_operador"
  on public.gastos_administrativos for insert
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "gastos_admin_update_admin_operador"
  on public.gastos_administrativos for update
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "gastos_admin_delete_admin_only"
  on public.gastos_administrativos for delete
  using (public.current_user_role() = 'admin');

-- --- audit_log: solo lectura, solo admin ------------------------------------
alter table public.audit_log enable row level security;

create policy "audit_log_select_admin_only"
  on public.audit_log for select
  using (public.current_user_role() = 'admin');
-- Sin política de insert/update/delete para usuarios: solo lo escriben los
-- triggers (security definer), nunca directamente un cliente.
