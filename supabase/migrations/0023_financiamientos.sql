-- ============================================================================
-- ATS SAAS · Fase 3 · Financiamientos y calendario de cuotas
--
-- Las cuotas de un crédito NO son gasto: la amortización de capital es salida
-- de caja contra deuda, no costo del mes. Por eso viven en su propia tabla y
-- entran al flujo de caja sin tocar los gastos ni el EERR. Solo el interés
-- sería gasto, y eso queda para cuando se conozca la tasa.
--
-- El vencimiento del crédito del camión es el 6 de cada mes, corrido al
-- siguiente hábil cuando cae fin de semana. La regla se verificó contra las
-- seis fechas que publica el banco: el 6-dic-2026 (domingo) vence el 7, y el
-- 6-feb y 6-mar-2027 (sábados) vencen el 8.
-- ============================================================================

create type public.tipo_financiamiento as enum ('credito', 'leasing', 'otro');

create table public.financiamientos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  tipo public.tipo_financiamiento not null default 'credito',
  institucion text,
  cuenta text,
  -- Un crédito a nombre del socio que financia un activo de la empresa no es
  -- lo mismo que uno de la empresa: cambia a quién se le paga y cómo se
  -- registra. Dejarlo escrito evita descubrirlo en el cierre.
  titular text,
  monto_cuota numeric(14, 2) not null,
  cuotas_totales integer not null check (cuotas_totales > 0),
  dia_vencimiento integer not null default 6 check (dia_vencimiento between 1 and 31),
  tasa_interes numeric(6, 3),
  activo boolean not null default true,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_financiamientos
  before update on public.financiamientos
  for each row execute procedure public.set_updated_at();

create table public.cuotas_financiamiento (
  id uuid primary key default gen_random_uuid(),
  financiamiento_id uuid not null references public.financiamientos (id) on delete cascade,
  numero integer not null,
  fecha_vencimiento date not null,
  monto numeric(14, 2) not null,
  pagada boolean not null default false,
  fecha_pago date,
  nota text,
  created_at timestamptz not null default now(),
  unique (financiamiento_id, numero)
);

create index on public.cuotas_financiamiento (pagada, fecha_vencimiento);

create trigger audit_cuotas_financiamiento
  after insert or update or delete on public.cuotas_financiamiento
  for each row execute procedure public.audit_trigger_fn();

-- --- Corrimiento a día hábil --------------------------------------------------
-- No contempla feriados: si el vencimiento cae en uno, el banco puede correrlo
-- un día más. La fecha es una estimación para prever fondos, no un compromiso
-- exacto con el banco.

create function public.vencimiento_habil(f date)
returns date
language sql
immutable
as $$
  select case extract(isodow from f)
    when 6 then f + 2  -- sábado  -> lunes
    when 7 then f + 1  -- domingo -> lunes
    else f
  end;
$$;

comment on function public.vencimiento_habil(date) is
  'Corre un vencimiento de fin de semana al lunes siguiente. No considera feriados.';

-- --- RLS ----------------------------------------------------------------------

alter table public.financiamientos enable row level security;
alter table public.cuotas_financiamiento enable row level security;

create policy "financiamientos_select_authenticated"
  on public.financiamientos for select using (auth.uid() is not null);
create policy "financiamientos_write_admin"
  on public.financiamientos for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "cuotas_select_authenticated"
  on public.cuotas_financiamiento for select using (auth.uid() is not null);
create policy "cuotas_update_admin_operador"
  on public.cuotas_financiamiento for update
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));
create policy "cuotas_write_admin"
  on public.cuotas_financiamiento for insert
  with check (public.current_user_role() = 'admin');
create policy "cuotas_delete_admin"
  on public.cuotas_financiamiento for delete
  using (public.current_user_role() = 'admin');

-- --- Crédito del camión pluma --------------------------------------------------

insert into public.financiamientos
  (codigo, nombre, tipo, institucion, cuenta, titular, monto_cuota, cuotas_totales,
   dia_vencimiento, nota)
values
  ('credito-camion', 'Crédito camión pluma Volkswagen 8x4', 'credito',
   'Por confirmar', '****0477', 'Mario Aguilera (personal)',
   1437738, 54, 6,
   'El crédito está a nombre del socio y financia un activo de la empresa: el Excel lo registra como "pago cuota camión vía Mario Aguilera". Falta la tasa para separar interés de capital.');

-- Las cuotas 1 a 7 ya están pagadas; la 8 vence el 06-11-2026.
insert into public.cuotas_financiamiento (financiamiento_id, numero, fecha_vencimiento, monto)
select
  f.id,
  n,
  public.vencimiento_habil((date '2026-11-06' + make_interval(months => n - 8))::date),
  f.monto_cuota
from public.financiamientos f
cross join generate_series(8, 54) as n
where f.codigo = 'credito-camion';

-- --- Cuotas pendientes ---------------------------------------------------------

create view public.v_cuotas_pendientes
with (security_invoker = true) as
select
  cf.id,
  f.codigo,
  f.nombre,
  f.institucion,
  f.titular,
  cf.numero,
  f.cuotas_totales,
  cf.fecha_vencimiento,
  cf.monto,
  (cf.fecha_vencimiento < current_date) as vencida,
  (cf.fecha_vencimiento - current_date) as dias_restantes,
  date_trunc('month', cf.fecha_vencimiento)::date as mes_pago
from public.cuotas_financiamiento cf
join public.financiamientos f on f.id = cf.financiamiento_id
where cf.pagada = false
  and f.activo;

comment on view public.v_cuotas_pendientes is
  'Cuotas de crédito y leasing por vencer. Son salida de caja, no gasto: no entran al EERR.';

-- --- Flujo de caja, ahora con las cuotas ---------------------------------------

drop view if exists public.v_flujo_caja;

create view public.v_flujo_caja
with (security_invoker = true) as
select mes_cobro as mes, 'entrada'::text as direccion, 'cobranza'::text as concepto,
       sum(monto) as monto, count(*) as documentos
from public.v_cobranza
where mes_cobro is not null
group by 1
union all
select mes_pago, 'salida', 'gastos', sum(total), count(*)
from public.v_calendario_pagos
where mes_pago is not null
group by 1
union all
select mes_pago, 'salida', 'cuotas', sum(monto), count(*)
from public.v_cuotas_pendientes
group by 1;

comment on view public.v_flujo_caja is
  'Cobranza esperada contra compromisos de pago y cuotas de financiamiento, por mes. Es proyección: no incluye el saldo en cuenta.';
