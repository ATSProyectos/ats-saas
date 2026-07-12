-- ============================================================================
-- ATS SAAS · Fase 2.2 · Petróleo TCT vs sin TCT
--   costos_petroleo  ->  costos_petroleo_tct  (cargas Copec TCT desde CSV)
--   nueva columna    ->  costos_petroleo_sin_tct (cargas fuera de TCT)
-- Ambas son de SOLO LECTURA en la app: las alimenta el módulo Combustible.
-- ============================================================================

drop view if exists public.v_rentabilidad_servicio;
drop view if exists public.v_rentabilidad_por_cliente;
drop view if exists public.v_rentabilidad_mensual;

alter table public.ventas_servicios
  drop column if exists margen_bruto,
  drop column if exists costos_directos;

alter table public.ventas_servicios
  rename column costos_petroleo to costos_petroleo_tct;

alter table public.ventas_servicios
  add column if not exists costos_petroleo_sin_tct numeric(14, 2) not null default 0;

alter table public.ventas_servicios
  add column costos_directos numeric(14, 2) generated always as (
    variable_operador + salida_caja + viaticos_extras + comision_venta +
    pago_terceros + pago_iva_terceros +
    costos_petroleo_tct + costos_petroleo_sin_tct + tag_peajes
  ) stored,
  add column margen_bruto numeric(14, 2) generated always as (
    (
      coalesce(valor_pluma_hora, 0) * coalesce(cantidad_horas, 0)
      + coalesce(valor_flete, 0) + coalesce(rigger, 0) + coalesce(extras, 0)
    )
    - (
      variable_operador + salida_caja + viaticos_extras + comision_venta +
      pago_terceros + pago_iva_terceros +
      costos_petroleo_tct + costos_petroleo_sin_tct + tag_peajes
    )
  ) stored;

-- Marca de modalidad en los consumos de combustible (TCT por defecto).
alter table public.consumos_combustible
  add column if not exists es_tct boolean not null default true;

-- Recrear vistas (idénticas).
create view public.v_rentabilidad_servicio
with (security_invoker = true) as
select
  vs.id, vs.fecha_servicio, c.nombre as cliente, o.nombre as operador,
  vs.servicio_tipo, vs.monto_neto as ingreso_neto, vs.costos_directos, vs.margen_bruto,
  case when vs.monto_neto > 0 then round((vs.margen_bruto / vs.monto_neto) * 100, 1) else null end as pct_margen_bruto
from public.ventas_servicios vs
join public.clientes c on c.id = vs.cliente_id
left join public.operadores o on o.id = vs.operador_id;

create view public.v_rentabilidad_por_cliente
with (security_invoker = true) as
select
  c.id as cliente_id, c.nombre as cliente, count(vs.id) as cantidad_servicios,
  sum(vs.monto_neto) as ingreso_neto_total, sum(vs.costos_directos) as costos_directos_total,
  sum(vs.margen_bruto) as margen_bruto_total,
  case when sum(vs.monto_neto) > 0 then round((sum(vs.margen_bruto) / sum(vs.monto_neto)) * 100, 1) else null end as pct_margen_bruto
from public.clientes c
join public.ventas_servicios vs on vs.cliente_id = c.id
group by c.id, c.nombre;

create view public.v_rentabilidad_mensual
with (security_invoker = true) as
select
  date_trunc('month', vs.fecha_servicio)::date as mes, count(vs.id) as cantidad_servicios,
  sum(vs.monto_neto) as ingreso_neto_total, sum(vs.costos_directos) as costos_directos_total,
  sum(vs.margen_bruto) as margen_bruto_total,
  case when sum(vs.monto_neto) > 0 then round((sum(vs.margen_bruto) / sum(vs.monto_neto)) * 100, 1) else null end as pct_margen_bruto
from public.ventas_servicios vs
group by date_trunc('month', vs.fecha_servicio)
order by mes desc;
