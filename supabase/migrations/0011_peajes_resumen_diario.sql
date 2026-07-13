-- ============================================================================
-- ATS SAAS · Fase 2.4 · Resumen diario de peajes/TAG
-- ============================================================================

create view public.v_peajes_diario
with (security_invoker = true) as
select
  fecha,
  concesionaria,
  count(*) as cantidad_movimientos,
  sum(monto) as monto_total,
  count(*) filter (where venta_servicio_id is not null) as asignados,
  count(*) filter (where venta_servicio_id is null) as sin_asignar
from public.peajes_tag
group by fecha, concesionaria
order by fecha desc, concesionaria;
