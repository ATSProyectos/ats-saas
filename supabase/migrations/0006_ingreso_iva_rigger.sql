-- ============================================================================
-- ATS SAAS · Fase 2.1 · Fórmula de ingreso + IVA automático + campo Rigger
--   Ingreso neto = pluma(hora*valor) + flete + rigger + extras
--   IVA          = 19% del ingreso neto (automático)
--   Total        = neto + IVA
-- Nota: en Postgres una columna generada NO puede referenciar a otra columna
-- generada, por eso la expresión de ingreso se repite en cada fórmula.
-- ============================================================================

-- 1) Quitar las vistas que dependen de las columnas derivadas.
drop view if exists public.v_rentabilidad_servicio;
drop view if exists public.v_rentabilidad_por_cliente;
drop view if exists public.v_rentabilidad_mensual;

-- 2) Quitar columnas derivadas (dependientes primero).
alter table public.ventas_servicios
  drop column if exists margen_bruto,
  drop column if exists total,
  drop column if exists costos_directos,
  drop column if exists iva,
  drop column if exists monto_neto;

-- 3) Nuevo campo de ingreso: Rigger.
alter table public.ventas_servicios
  add column if not exists rigger numeric(14, 2) not null default 0;

-- 4) Reconstruir columnas derivadas.
alter table public.ventas_servicios
  add column monto_neto numeric(14, 2) generated always as (
    coalesce(valor_pluma_hora, 0) * coalesce(cantidad_horas, 0)
    + coalesce(valor_flete, 0) + coalesce(rigger, 0) + coalesce(extras, 0)
  ) stored,
  add column iva numeric(14, 2) generated always as (
    round((
      coalesce(valor_pluma_hora, 0) * coalesce(cantidad_horas, 0)
      + coalesce(valor_flete, 0) + coalesce(rigger, 0) + coalesce(extras, 0)
    ) * 0.19)
  ) stored,
  add column total numeric(14, 2) generated always as (
    (
      coalesce(valor_pluma_hora, 0) * coalesce(cantidad_horas, 0)
      + coalesce(valor_flete, 0) + coalesce(rigger, 0) + coalesce(extras, 0)
    )
    + round((
      coalesce(valor_pluma_hora, 0) * coalesce(cantidad_horas, 0)
      + coalesce(valor_flete, 0) + coalesce(rigger, 0) + coalesce(extras, 0)
    ) * 0.19)
  ) stored,
  add column costos_directos numeric(14, 2) generated always as (
    variable_operador + salida_caja + viaticos_extras + comision_venta +
    pago_terceros + pago_iva_terceros + costos_petroleo + tag_peajes
  ) stored,
  add column margen_bruto numeric(14, 2) generated always as (
    (
      coalesce(valor_pluma_hora, 0) * coalesce(cantidad_horas, 0)
      + coalesce(valor_flete, 0) + coalesce(rigger, 0) + coalesce(extras, 0)
    )
    - (
      variable_operador + salida_caja + viaticos_extras + comision_venta +
      pago_terceros + pago_iva_terceros + costos_petroleo + tag_peajes
    )
  ) stored;

-- 5) Recrear las vistas de rentabilidad (idénticas a la versión anterior).
create view public.v_rentabilidad_servicio
with (security_invoker = true) as
select
  vs.id,
  vs.fecha_servicio,
  c.nombre as cliente,
  o.nombre as operador,
  vs.servicio_tipo,
  vs.monto_neto as ingreso_neto,
  vs.costos_directos,
  vs.margen_bruto,
  case
    when vs.monto_neto > 0 then round((vs.margen_bruto / vs.monto_neto) * 100, 1)
    else null
  end as pct_margen_bruto
from public.ventas_servicios vs
join public.clientes c on c.id = vs.cliente_id
left join public.operadores o on o.id = vs.operador_id;

create view public.v_rentabilidad_por_cliente
with (security_invoker = true) as
select
  c.id as cliente_id,
  c.nombre as cliente,
  count(vs.id) as cantidad_servicios,
  sum(vs.monto_neto) as ingreso_neto_total,
  sum(vs.costos_directos) as costos_directos_total,
  sum(vs.margen_bruto) as margen_bruto_total,
  case
    when sum(vs.monto_neto) > 0
      then round((sum(vs.margen_bruto) / sum(vs.monto_neto)) * 100, 1)
    else null
  end as pct_margen_bruto
from public.clientes c
join public.ventas_servicios vs on vs.cliente_id = c.id
group by c.id, c.nombre;

create view public.v_rentabilidad_mensual
with (security_invoker = true) as
select
  date_trunc('month', vs.fecha_servicio)::date as mes,
  count(vs.id) as cantidad_servicios,
  sum(vs.monto_neto) as ingreso_neto_total,
  sum(vs.costos_directos) as costos_directos_total,
  sum(vs.margen_bruto) as margen_bruto_total,
  case
    when sum(vs.monto_neto) > 0
      then round((sum(vs.margen_bruto) / sum(vs.monto_neto)) * 100, 1)
    else null
  end as pct_margen_bruto
from public.ventas_servicios vs
group by date_trunc('month', vs.fecha_servicio)
order by mes desc;
