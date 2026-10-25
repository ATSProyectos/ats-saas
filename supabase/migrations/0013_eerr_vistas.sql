-- ============================================================================
-- ATS SAAS · Fase 3.2 · Estado de resultados mensual: vistas
--
--   v_eerr_movimientos    un registro por documento, ya clasificado en su
--                         línea del EERR. Es la base del drill-down: desde
--                         cualquier línea se llega a las facturas que la
--                         componen.
--   v_eerr_mensual        el EERR consolidado: una fila por mes y línea,
--                         con los subtotales ya calculados.
--   v_eerr_mensual_tipo   el mismo EERR desglosado por tipo de servicio.
--   v_eerr_control        alertas de calidad de datos del reporte.
--
-- Todas heredan RLS de las tablas base (security_invoker).
-- ============================================================================

-- --- Hechos del EERR --------------------------------------------------------
-- Montos NETOS en ingresos y gastos. Combustible y peajes entran con el monto
-- que informa el proveedor, igual que hoy los imputa cada módulo al servicio:
-- así el margen bruto del EERR cuadra exactamente con ventas_servicios.
-- v_eerr_control cuantifica el IVA que viene dentro de esas líneas.
create view public.v_eerr_movimientos
with (security_invoker = true) as

-- 1 y 2 · Ingresos y costos directos, devengados en la fecha del servicio.
select
  date_trunc('month', vs.fecha_servicio)::date as mes,
  vs.fecha_servicio as fecha,
  l.linea_codigo,
  l.monto,
  'venta'::text as fuente,
  vs.id as origen_id,
  coalesce(nullif(btrim(vs.servicio_tipo), ''), 'Sin tipo') as servicio_tipo,
  c.nombre as detalle,
  vs.n_factura as documento
from public.ventas_servicios vs
join public.clientes c on c.id = vs.cliente_id
cross join lateral (values
  ('1.1', coalesce(vs.valor_pluma_hora, 0) * coalesce(vs.cantidad_horas, 0)),
  ('1.2', coalesce(vs.valor_flete, 0)),
  ('1.3', coalesce(vs.rigger, 0)),
  ('1.4', coalesce(vs.extras, 0)),
  ('2.1', vs.variable_operador),
  ('2.2', vs.viaticos_extras),
  ('2.3', vs.salida_caja),
  ('2.4', vs.costos_petroleo_tct),
  ('2.5', vs.costos_petroleo_sin_tct),
  ('2.6', vs.tag_peajes),
  ('2.7', vs.pago_terceros),
  ('2.8', vs.pago_iva_terceros),
  ('2.9', vs.comision_venta)
) as l (linea_codigo, monto)
where l.monto <> 0

union all

-- 3 y 4 · Gastos operacionales, por su categoría. Sin tipo de servicio: en el
-- desglose por tipo se prorratean (ver v_eerr_mensual_tipo).
select
  date_trunc('month', go.fecha)::date,
  go.fecha,
  coalesce(m.linea_codigo, '0.0'),
  go.monto_neto,
  'gasto_operacional',
  go.id,
  null,
  coalesce(nullif(btrim(go.proveedor), ''), go.descripcion, 'Sin detalle'),
  go.n_factura
from public.gastos_operacionales go
left join public.eerr_mapeo m on m.categoria_costo_id = go.categoria_costo_id
where go.monto_neto <> 0

union all

-- 4 · Gastos administrativos.
select
  date_trunc('month', ga.fecha)::date,
  ga.fecha,
  coalesce(m.linea_codigo, '0.0'),
  ga.monto_neto,
  'gasto_administrativo',
  ga.id,
  null,
  coalesce(nullif(btrim(ga.descripcion), ''), 'Sin detalle'),
  null
from public.gastos_administrativos ga
left join public.eerr_mapeo m on m.categoria_costo_id = ga.categoria_costo_id
where ga.monto_neto <> 0

union all

-- 3.4 · Combustible que no quedó asignado a ningún servicio.
select
  date_trunc('month', cc.fecha)::date,
  cc.fecha,
  '3.4',
  cc.monto,
  'combustible_no_asignado',
  cc.id,
  null,
  coalesce(nullif(btrim(cc.estacion), ''), 'Carga sin estación')
    || coalesce(' · ' || cc.patente, ''),
  cc.guia_despacho
from public.consumos_combustible cc
where cc.venta_servicio_id is null
  and cc.monto <> 0

union all

-- 3.5 · Peajes y TAG que no quedaron asignados a ningún servicio.
select
  date_trunc('month', pt.fecha)::date,
  pt.fecha,
  '3.5',
  pt.monto,
  'peaje_no_asignado',
  pt.id,
  null,
  coalesce(nullif(btrim(pt.concesionaria), ''), 'Sin concesionaria')
    || coalesce(' · ' || pt.patente, ''),
  pt.documento
from public.peajes_tag pt
where pt.venta_servicio_id is null
  and pt.monto <> 0;

-- --- EERR consolidado por mes ------------------------------------------------
create view public.v_eerr_mensual
with (security_invoker = true) as
with detalle as (
  select mes, linea_codigo, sum(monto) as monto
  from public.v_eerr_movimientos
  group by mes, linea_codigo
),
grupos as (
  select
    d.mes,
    coalesce(sum(d.monto) filter (where l.grupo = 'ingresos'), 0) as ingresos,
    coalesce(sum(d.monto) filter (where l.grupo = 'costo_directo'), 0) as costo_directo,
    coalesce(sum(d.monto) filter (where l.grupo = 'indirecto'), 0) as indirecto,
    coalesce(sum(d.monto) filter (where l.grupo = 'gav'), 0) as gav,
    coalesce(sum(d.monto) filter (where l.grupo = 'sin_clasificar'), 0) as sin_clasificar
  from detalle d
  join public.eerr_lineas l on l.codigo = d.linea_codigo
  group by d.mes
),
subtotales as (
  select mes, 'T1' as linea_codigo, ingresos as monto from grupos
  union all select mes, 'T2', costo_directo from grupos
  union all select mes, 'T3', ingresos - costo_directo from grupos
  union all select mes, 'T4', indirecto from grupos
  union all select mes, 'T5', ingresos - costo_directo - indirecto from grupos
  union all select mes, 'T6', gav from grupos
  union all select mes, 'T7',
    ingresos - costo_directo - indirecto - gav - sin_clasificar from grupos
),
todo as (
  select mes, linea_codigo, monto from detalle
  union all
  select mes, linea_codigo, monto from subtotales
)
select
  g.mes,
  l.codigo,
  l.nombre,
  l.grupo,
  l.tipo,
  l.orden,
  l.nota,
  coalesce(t.monto, 0) as monto,
  case
    when g.ingresos > 0 then round(coalesce(t.monto, 0) / g.ingresos * 100, 1)
    else null
  end as pct_ingresos
from grupos g
cross join public.eerr_lineas l
left join todo t on t.mes = g.mes and t.linea_codigo = l.codigo
order by g.mes desc, l.orden;

-- --- EERR por tipo de servicio -----------------------------------------------
-- Ingresos y costos directos se asignan al tipo de servicio de la venta.
-- Indirectos, GAV y sin clasificar se prorratean por participación en los
-- ingresos netos del mes: no son atribuibles a un servicio puntual.
create view public.v_eerr_mensual_tipo
with (security_invoker = true) as
with ingresos_tipo as (
  select mv.mes, mv.servicio_tipo, sum(mv.monto) as ingreso
  from public.v_eerr_movimientos mv
  join public.eerr_lineas l on l.codigo = mv.linea_codigo
  where l.grupo = 'ingresos' and mv.servicio_tipo is not null
  group by mv.mes, mv.servicio_tipo
),
total_mes as (
  select mes, sum(ingreso) as ingreso_mes from ingresos_tipo group by mes
),
prorrateable as (
  select mv.mes, mv.linea_codigo, sum(mv.monto) as monto
  from public.v_eerr_movimientos mv
  join public.eerr_lineas l on l.codigo = mv.linea_codigo
  where l.grupo in ('indirecto', 'gav', 'sin_clasificar')
  group by mv.mes, mv.linea_codigo
),
factores as (
  select it.mes, it.servicio_tipo, it.ingreso / tm.ingreso_mes as factor
  from ingresos_tipo it
  join total_mes tm on tm.mes = it.mes
  where tm.ingreso_mes > 0
  union all
  -- Mes con gastos y sin ingresos: no hay base de prorrateo, todo queda junto.
  select p.mes, 'Sin ingresos del mes'::text, 1::numeric
  from (select distinct mes from prorrateable) p
  left join total_mes tm on tm.mes = p.mes
  where coalesce(tm.ingreso_mes, 0) <= 0
),
directo as (
  select mv.mes, mv.servicio_tipo, mv.linea_codigo, sum(mv.monto) as monto
  from public.v_eerr_movimientos mv
  join public.eerr_lineas l on l.codigo = mv.linea_codigo
  where l.grupo in ('ingresos', 'costo_directo') and mv.servicio_tipo is not null
  group by mv.mes, mv.servicio_tipo, mv.linea_codigo
),
base as (
  select mes, servicio_tipo, linea_codigo, monto from directo
  union all
  select p.mes, f.servicio_tipo, p.linea_codigo, p.monto * f.factor
  from prorrateable p
  join factores f on f.mes = p.mes
),
grupos as (
  select
    b.mes,
    b.servicio_tipo,
    coalesce(sum(b.monto) filter (where l.grupo = 'ingresos'), 0) as ingresos,
    coalesce(sum(b.monto) filter (where l.grupo = 'costo_directo'), 0) as costo_directo,
    coalesce(sum(b.monto) filter (where l.grupo = 'indirecto'), 0) as indirecto,
    coalesce(sum(b.monto) filter (where l.grupo = 'gav'), 0) as gav,
    coalesce(sum(b.monto) filter (where l.grupo = 'sin_clasificar'), 0) as sin_clasificar
  from base b
  join public.eerr_lineas l on l.codigo = b.linea_codigo
  group by b.mes, b.servicio_tipo
),
subtotales as (
  select mes, servicio_tipo, 'T1' as linea_codigo, ingresos as monto from grupos
  union all select mes, servicio_tipo, 'T2', costo_directo from grupos
  union all select mes, servicio_tipo, 'T3', ingresos - costo_directo from grupos
  union all select mes, servicio_tipo, 'T4', indirecto from grupos
  union all select mes, servicio_tipo, 'T5', ingresos - costo_directo - indirecto from grupos
  union all select mes, servicio_tipo, 'T6', gav from grupos
  union all select mes, servicio_tipo, 'T7',
    ingresos - costo_directo - indirecto - gav - sin_clasificar from grupos
),
todo as (
  select mes, servicio_tipo, linea_codigo, sum(monto) as monto
  from base group by mes, servicio_tipo, linea_codigo
  union all
  select mes, servicio_tipo, linea_codigo, monto from subtotales
)
select
  g.mes,
  g.servicio_tipo,
  l.codigo,
  l.nombre,
  l.grupo,
  l.tipo,
  l.orden,
  coalesce(t.monto, 0) as monto,
  case
    when g.ingresos > 0 then round(coalesce(t.monto, 0) / g.ingresos * 100, 1)
    else null
  end as pct_ingresos
from grupos g
cross join public.eerr_lineas l
left join todo t
  on t.mes = g.mes
 and t.servicio_tipo = g.servicio_tipo
 and t.linea_codigo = l.codigo
where l.grupo <> 'excluido'
order by g.mes desc, g.servicio_tipo, l.orden;

-- --- Control de calidad del reporte ------------------------------------------
-- Lo que el EERR no puede resolver solo y alguien tiene que revisar.
create view public.v_eerr_control
with (security_invoker = true) as

-- Gastos cuya categoría no tiene línea asignada: caen en la línea 0.0.
select
  'categoria_sin_mapeo'::text as alerta,
  date_trunc('month', g.fecha)::date as mes,
  cc.categoria || ' / ' || cc.subcategoria as detalle,
  count(*)::int as cantidad,
  sum(g.monto_neto) as monto
from (
  select fecha, categoria_costo_id, monto_neto from public.gastos_operacionales
  union all
  select fecha, categoria_costo_id, monto_neto from public.gastos_administrativos
) g
join public.categorias_costo cc on cc.id = g.categoria_costo_id
left join public.eerr_mapeo m on m.categoria_costo_id = g.categoria_costo_id
where m.id is null
group by 1, 2, 3

union all

-- Gastos sin categoría: también caen en la línea 0.0.
select
  'gasto_sin_categoria',
  date_trunc('month', g.fecha)::date,
  'Gasto cargado sin categoría de costo',
  count(*)::int,
  sum(g.monto_neto)
from (
  select fecha, categoria_costo_id, monto_neto from public.gastos_operacionales
  union all
  select fecha, categoria_costo_id, monto_neto from public.gastos_administrativos
) g
where g.categoria_costo_id is null
group by 1, 2, 3

union all

-- Gasto operacional ligado a un servicio: puede estar también digitado en los
-- costos directos de esa venta, y entonces el costo se cuenta dos veces.
select
  'posible_doble_conteo',
  date_trunc('month', go.fecha)::date,
  coalesce(nullif(btrim(go.proveedor), ''), go.descripcion, 'Sin detalle')
    || ' · ligado a un servicio',
  count(*)::int,
  sum(go.monto_neto)
from public.gastos_operacionales go
where go.venta_servicio_id is not null
group by 1, 2, 3

union all

-- Combustible y peajes entran con el monto del proveedor (IVA incluido),
-- mientras el resto del EERR es neto. Esto es cuánto pesa esa diferencia.
select
  'iva_dentro_de_costos',
  mv.mes,
  'Combustible y peajes se cargan con IVA incluido; el resto del EERR es neto',
  count(*)::int,
  sum(mv.monto) - round(sum(mv.monto) / 1.19, 0)
from public.v_eerr_movimientos mv
where mv.linea_codigo in ('2.4', '2.5', '2.6', '3.4', '3.5')
group by 1, 2, 3

union all

-- El tipo de servicio es texto libre: dos formas de escribirlo son dos
-- columnas distintas en el desglose por tipo.
select
  'tipo_servicio_duplicado',
  null::date,
  string_agg(s.servicio_tipo, ' | ' order by s.servicio_tipo),
  count(*)::int,
  null::numeric
from (
  select distinct btrim(servicio_tipo) as servicio_tipo
  from public.ventas_servicios
  where btrim(coalesce(servicio_tipo, '')) <> ''
) s
group by lower(s.servicio_tipo)
having count(*) > 1;

-- --- Catálogo de categorías con su línea del EERR ----------------------------
-- La usa el formulario de gastos para mostrar, al momento de cargar, en qué
-- línea del resultado va a quedar el gasto.
create view public.v_categorias_eerr
with (security_invoker = true) as
select
  cc.id,
  cc.categoria,
  cc.subcategoria,
  coalesce(m.linea_codigo, '0.0') as linea_codigo,
  coalesce(l.nombre, 'Sin clasificar (revisar mapeo)') as linea_nombre,
  coalesce(l.grupo, 'sin_clasificar') as linea_grupo,
  m.nota as nota_mapeo
from public.categorias_costo cc
left join public.eerr_mapeo m on m.categoria_costo_id = cc.id
left join public.eerr_lineas l on l.codigo = m.linea_codigo;
