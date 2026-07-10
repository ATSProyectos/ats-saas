-- ============================================================================
-- ATS SAAS · Fase 1 · Esquema base
-- Modelado a partir de "Registro_Flujo_ATS_Proyectos_260709.xlsx"
-- ============================================================================

-- --- Perfiles y roles (extiende auth.users de Supabase) ---------------------
create type public.user_role as enum ('admin', 'operador', 'lector');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'lector',
  created_at timestamptz not null default now()
);

-- Crea automáticamente un perfil (rol "lector") cuando alguien se registra.
-- El primer usuario (Mario) se promueve a "admin" manualmente después, ver
-- instrucciones de la Fase 1.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'lector');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- --- Catálogos ---------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create table public.operadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz not null default now()
);

-- Categoría/Subcategoría de costos, tal como en la hoja Base_Categorías.
create table public.categorias_costo (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  subcategoria text not null,
  created_at timestamptz not null default now(),
  unique (categoria, subcategoria)
);

-- --- Tabla central: servicios vendidos (hoja Ventas_Servicios) --------------
create table public.ventas_servicios (
  id uuid primary key default gen_random_uuid(),
  fecha_servicio date not null,
  cliente_id uuid not null references public.clientes (id),
  proyecto_obra text,
  origen text,
  destino text,
  servicio_tipo text,
  comentario text,
  valor_pluma_hora numeric(14, 2),
  cantidad_horas numeric(10, 2),
  valor_flete numeric(14, 2),
  extras numeric(14, 2),
  n_guia text,
  n_oc text,
  descripcion_carga text,
  monto_neto numeric(14, 2) not null default 0,
  iva numeric(14, 2) not null default 0,
  total numeric(14, 2) generated always as (monto_neto + iva) stored,
  n_cotizacion text,
  n_factura text,
  fecha_facturacion date,
  fecha_estimada_pago date,
  fecha_pago date,
  operador_id uuid references public.operadores (id),
  variable_operador numeric(14, 2) not null default 0,
  salida_caja numeric(14, 2) not null default 0,
  viaticos_extras numeric(14, 2) not null default 0,
  comision_venta numeric(14, 2) not null default 0,
  pago_terceros numeric(14, 2) not null default 0,
  pago_iva_terceros numeric(14, 2) not null default 0,
  n_factura_tercero text,
  n_reporte text,
  km_inicio numeric(10, 1),
  km_fin numeric(10, 1),
  km_servicio numeric(10, 1),
  costos_petroleo numeric(14, 2) not null default 0,
  h_operacion numeric(10, 2),
  tag_peajes numeric(14, 2) not null default 0,
  -- Margen bruto = ingreso neto menos los costos directos del servicio.
  costos_directos numeric(14, 2) generated always as (
    variable_operador + salida_caja + viaticos_extras + comision_venta +
    pago_terceros + pago_iva_terceros + costos_petroleo + tag_peajes
  ) stored,
  margen_bruto numeric(14, 2) generated always as (
    monto_neto - (
      variable_operador + salida_caja + viaticos_extras + comision_venta +
      pago_terceros + pago_iva_terceros + costos_petroleo + tag_peajes
    )
  ) stored,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.ventas_servicios (cliente_id);
create index on public.ventas_servicios (operador_id);
create index on public.ventas_servicios (fecha_servicio);

-- --- Costos operacionales (hoja Gastos_Operacionales) ------------------------
create table public.gastos_operacionales (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  categoria_costo_id uuid references public.categorias_costo (id),
  proveedor text,
  proyecto_servicio text,
  venta_servicio_id uuid references public.ventas_servicios (id),
  descripcion text,
  monto_neto numeric(14, 2) not null default 0,
  iva numeric(14, 2) not null default 0,
  total numeric(14, 2) generated always as (monto_neto + iva) stored,
  facturado_ats text,
  n_factura text,
  medio_pago text,
  tipo_costo text,
  comentario text,
  km numeric(10, 1),
  litros numeric(10, 2),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index on public.gastos_operacionales (fecha);
create index on public.gastos_operacionales (categoria_costo_id);

-- --- Costos administrativos (hoja Gastos_Admin) ------------------------------
create table public.gastos_administrativos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  descripcion text,
  categoria_costo_id uuid references public.categorias_costo (id),
  monto_neto numeric(14, 2) not null default 0,
  iva numeric(14, 2) not null default 0,
  total numeric(14, 2) generated always as (monto_neto + iva) stored,
  facturado_ats text,
  medio_pago text,
  tipo_costo text,
  observaciones text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index on public.gastos_administrativos (fecha);
create index on public.gastos_administrativos (categoria_costo_id);

-- --- Auditoría ----------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.audit_log (table_name, record_id, action, changed_by, old_data, new_data)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_ventas_servicios
  after insert or update or delete on public.ventas_servicios
  for each row execute procedure public.audit_trigger_fn();

create trigger audit_gastos_operacionales
  after insert or update or delete on public.gastos_operacionales
  for each row execute procedure public.audit_trigger_fn();

create trigger audit_gastos_administrativos
  after insert or update or delete on public.gastos_administrativos
  for each row execute procedure public.audit_trigger_fn();

-- --- updated_at automático en ventas_servicios --------------------------------
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_ventas_servicios
  before update on public.ventas_servicios
  for each row execute procedure public.set_updated_at();
