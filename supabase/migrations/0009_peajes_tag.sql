-- ============================================================================
-- ATS SAAS · Fase 2.2 · Peajes y TAG (módulo centralizado)
-- Registra movimientos de TAG/peajes (manual o importados por CSV de cada
-- concesionaria) y los asigna a servicios. tag_peajes del servicio se
-- recalcula desde la app (columna de solo lectura en el formulario).
-- ============================================================================

create table public.peajes_tag (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  concesionaria text,
  patente text,
  descripcion text,
  monto numeric(14, 2) not null default 0,
  documento text, -- id de transacción/comprobante (para no duplicar al importar)
  venta_servicio_id uuid references public.ventas_servicios (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (concesionaria, documento)
);

create index on public.peajes_tag (fecha);
create index on public.peajes_tag (venta_servicio_id);

create trigger audit_peajes_tag
  after insert or update or delete on public.peajes_tag
  for each row execute procedure public.audit_trigger_fn();

alter table public.peajes_tag enable row level security;

create policy "peajes_select_authenticated"
  on public.peajes_tag for select
  using (auth.uid() is not null);

create policy "peajes_insert_admin_operador"
  on public.peajes_tag for insert
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "peajes_update_admin_operador"
  on public.peajes_tag for update
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "peajes_delete_admin_only"
  on public.peajes_tag for delete
  using (public.current_user_role() = 'admin');
