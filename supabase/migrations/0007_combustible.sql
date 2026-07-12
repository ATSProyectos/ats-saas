-- ============================================================================
-- ATS SAAS · Fase 2.1 · Consumos de combustible (importados desde CSV de Copec)
-- El usuario sube el CSV y asigna cada consumo al servicio que corresponde.
-- Al asignar, el costo de petróleo del servicio se recalcula desde la app.
-- ============================================================================

create table public.consumos_combustible (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora text,
  patente text,
  estacion text,
  comuna text,
  guia_despacho text unique, -- clave natural para evitar importar dos veces
  precio_litro numeric(14, 2),
  volumen_litros numeric(12, 2),
  monto numeric(14, 2) not null default 0,
  odometro_km numeric(12, 1),
  rendimiento_km_litro numeric(10, 2),
  venta_servicio_id uuid references public.ventas_servicios (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index on public.consumos_combustible (fecha);
create index on public.consumos_combustible (venta_servicio_id);

create trigger audit_consumos_combustible
  after insert or update or delete on public.consumos_combustible
  for each row execute procedure public.audit_trigger_fn();

-- --- RLS ---------------------------------------------------------------------
alter table public.consumos_combustible enable row level security;

create policy "combustible_select_authenticated"
  on public.consumos_combustible for select
  using (auth.uid() is not null);

create policy "combustible_insert_admin_operador"
  on public.consumos_combustible for insert
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "combustible_update_admin_operador"
  on public.consumos_combustible for update
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "combustible_delete_admin_only"
  on public.consumos_combustible for delete
  using (public.current_user_role() = 'admin');
