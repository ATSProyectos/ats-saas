-- ============================================================================
-- ATS SAAS · Fase 1 · Vistas de rentabilidad
-- Heredan RLS de las tablas base automáticamente (security_invoker).
-- ============================================================================

-- Rentabilidad por servicio individual (fila a fila).
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

-- Rentabilidad agregada por cliente.
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

-- Rentabilidad agregada por mes.
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

-- Gasto operacional agregado por categoría y mes (para el módulo de costos).
create view public.v_gastos_operacionales_mensual
with (security_invoker = true) as
select
  date_trunc('month', go.fecha)::date as mes,
  cc.categoria,
  cc.subcategoria,
  sum(go.total) as total_gastado
from public.gastos_operacionales go
left join public.categorias_costo cc on cc.id = go.categoria_costo_id
group by date_trunc('month', go.fecha), cc.categoria, cc.subcategoria
order by mes desc;
