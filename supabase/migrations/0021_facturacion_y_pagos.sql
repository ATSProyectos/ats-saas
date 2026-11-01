-- ============================================================================
-- ATS SAAS · Fase 3 · Facturación a nombre de ATS y estado de pago
--
-- Cierra dos de los huecos que docs/estado-resultados.md dejó anotados para
-- el flujo de caja: los gastos no tenían fecha de pago ni de vencimiento,
-- solo fecha de devengo, así que servían para el EERR pero no permitían
-- proyectar egresos.
--
-- Tres dimensiones distintas que hasta ahora vivían en una sola columna de
-- texto libre ("Si" / "SI" / "No" / "No / ATS cargo" / vacío):
--
--   facturacion_ats  ¿la factura está a nombre de ATS Proyectos? Define si
--                    hay crédito fiscal y qué va al balance de la empresa.
--   estado_pago      ¿está cerrado, por pagar, o comprometido a futuro?
--   fecha_estimada_pago  cuándo se espera pagarlo, para el calendario.
--
-- Son independientes: un gasto puede estar facturado a ATS y sin pagar, o
-- pagado de un bolsillo y sin factura a nombre de la empresa.
-- ============================================================================

create type public.facturacion_ats as enum (
  'facturado',     -- factura a nombre de ATS Proyectos: da crédito fiscal
  'no_facturado',  -- gasto real sin factura a nombre de la empresa
  'ats_cargo',     -- facturado a ATS Cargo, la relacionada, no a Proyectos
  'por_definir'    -- sin dato: queda visible en vez de asumirse facturado
);

create type public.estado_pago as enum (
  'cerrado',       -- facturado y pagado
  'por_pagar',     -- facturado sin pagar: cuenta por pagar
  'comprometido'   -- servicio sin facturar y sin pagar: pago futuro
);

-- --- Columnas nuevas en ambas tablas de gasto --------------------------------

alter table public.gastos_operacionales
  add column facturacion_ats public.facturacion_ats not null default 'por_definir',
  add column estado_pago public.estado_pago not null default 'cerrado',
  add column fecha_estimada_pago date,
  add column fecha_pago date;

alter table public.gastos_administrativos
  add column facturacion_ats public.facturacion_ats not null default 'por_definir',
  add column estado_pago public.estado_pago not null default 'cerrado',
  add column fecha_estimada_pago date,
  add column fecha_pago date;

comment on column public.gastos_operacionales.facturacion_ats is
  'Si la factura está a nombre de ATS Proyectos. Lo que NO lo está es lo que hay que informar aparte a contabilidad.';
comment on column public.gastos_operacionales.estado_pago is
  'cerrado = facturado y pagado · por_pagar = facturado sin pagar · comprometido = sin facturar y sin pagar.';

-- --- Traspaso del texto libre al enum ----------------------------------------
-- 'Si', 'SI' y 'si' conviven en los datos; el vacío NO se asume facturado.

update public.gastos_operacionales set facturacion_ats =
  case
    when facturado_ats is null or btrim(facturado_ats) = '' then 'por_definir'
    when lower(btrim(facturado_ats)) like '%cargo%'         then 'ats_cargo'
    when lower(btrim(facturado_ats)) = 'si'                 then 'facturado'
    when lower(btrim(facturado_ats)) = 'no'                 then 'no_facturado'
    else 'por_definir'
  end::public.facturacion_ats;

update public.gastos_administrativos set facturacion_ats =
  case
    when facturado_ats is null or btrim(facturado_ats) = '' then 'por_definir'
    when lower(btrim(facturado_ats)) like '%cargo%'         then 'ats_cargo'
    when lower(btrim(facturado_ats)) = 'si'                 then 'facturado'
    when lower(btrim(facturado_ats)) = 'no'                 then 'no_facturado'
    else 'por_definir'
  end::public.facturacion_ats;

-- Lo ya cargado viene del banco y del histórico: está pagado.
update public.gastos_operacionales   set fecha_pago = fecha where estado_pago = 'cerrado';
update public.gastos_administrativos set fecha_pago = fecha where estado_pago = 'cerrado';

alter table public.gastos_operacionales   drop column facturado_ats;
alter table public.gastos_administrativos drop column facturado_ats;

-- Un compromiso sin fecha estimada no entra al calendario y se pierde de vista.
alter table public.gastos_operacionales
  add constraint gastos_op_pendiente_con_fecha
  check (estado_pago = 'cerrado' or fecha_estimada_pago is not null) not valid;

alter table public.gastos_administrativos
  add constraint gastos_adm_pendiente_con_fecha
  check (estado_pago = 'cerrado' or fecha_estimada_pago is not null) not valid;

create index on public.gastos_operacionales (estado_pago, fecha_estimada_pago);
create index on public.gastos_administrativos (estado_pago, fecha_estimada_pago);

-- --- Vista unificada de gastos ------------------------------------------------
-- Las dos tablas comparten lo que importa para pagos y para contabilidad;
-- unirlas evita repetir el mismo UNION en cada consulta.

create view public.v_gastos
with (security_invoker = true) as
select
  g.id, 'operacional'::text as origen, g.fecha, g.categoria_costo_id,
  cc.categoria, cc.subcategoria, g.proveedor, g.descripcion, g.n_factura,
  g.monto_neto, g.iva, g.total, g.medio_pago,
  g.facturacion_ats, g.estado_pago, g.fecha_estimada_pago, g.fecha_pago
from public.gastos_operacionales g
left join public.categorias_costo cc on cc.id = g.categoria_costo_id
union all
select
  g.id, 'administrativo'::text, g.fecha, g.categoria_costo_id,
  cc.categoria, cc.subcategoria, null::text, g.descripcion, null::text,
  g.monto_neto, g.iva, g.total, g.medio_pago,
  g.facturacion_ats, g.estado_pago, g.fecha_estimada_pago, g.fecha_pago
from public.gastos_administrativos g
left join public.categorias_costo cc on cc.id = g.categoria_costo_id;

-- --- Calendario de pagos ------------------------------------------------------
-- Todo lo que no está cerrado, con su fecha estimada y si ya está vencido.

create view public.v_calendario_pagos
with (security_invoker = true) as
select
  v.*,
  (v.fecha_estimada_pago < current_date) as vencido,
  (v.fecha_estimada_pago - current_date) as dias_restantes,
  date_trunc('month', coalesce(v.fecha_estimada_pago, v.fecha))::date as mes_pago
from public.v_gastos v
where v.estado_pago <> 'cerrado';

comment on view public.v_calendario_pagos is
  'Compromisos pendientes de pago con su fecha estimada. Base de la previsión de fondos.';

-- --- Resumen para contabilidad -------------------------------------------------
-- Lo gastado que NO está facturado a nombre de ATS Proyectos, por mes y
-- categoría: es lo que hay que informar aparte para el balance.

create view public.v_gastos_no_facturados
with (security_invoker = true) as
select
  date_trunc('month', v.fecha)::date as mes,
  v.facturacion_ats,
  v.origen,
  coalesce(v.categoria, 'Sin categoría') as categoria,
  coalesce(v.subcategoria, '') as subcategoria,
  count(*) as documentos,
  sum(v.monto_neto) as neto,
  sum(v.iva) as iva,
  sum(v.total) as total
from public.v_gastos v
where v.facturacion_ats <> 'facturado'
group by 1, 2, 3, 4, 5;

comment on view public.v_gastos_no_facturados is
  'Gastos sin factura a nombre de ATS Proyectos, agrupados por mes y categoría. Es el resumen que va a los contadores.';
