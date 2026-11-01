-- ============================================================================
-- ATS SAAS · Fase 3 · Cobranza y flujo de caja
--
-- Cierra los dos huecos que quedaban del flujo de caja según
-- docs/estado-resultados.md:
--
--   "ventas_servicios.fecha_estimada_pago existe en la base y no se captura
--    en ningún formulario. Es el campo que proyecta la cobranza."
--   "clientes solo tiene nombre: sin condición de pago no se puede calcular
--    la fecha estimada como fecha_facturacion + días."
--
-- Los plazos no se inventan: salen de los 271 pagos del histórico, tomando la
-- mediana de días entre factura y pago de cada cliente. Con menos de tres
-- pagos la mediana es ruido, así que esos clientes quedan en blanco antes que
-- con un plazo inventado que nadie revisaría.
-- ============================================================================

alter table public.clientes
  add column dias_pago integer check (dias_pago is null or dias_pago between 0 and 365);

comment on column public.clientes.dias_pago is
  'Días entre facturación y pago. Calibrado con la mediana del histórico; en blanco significa que no hay datos suficientes y la fecha estimada se digita a mano.';

-- --- Plazos observados en el histórico ---------------------------------------

update public.clientes c set dias_pago = v.dias
from (values
  ('Andes Solar', 39),
  ('Subcargo', 42),
  ('ATS (Finning)', 14),
  ('ATS (Diperk)', 13),
  ('ATS (Besalco)', 2),
  ('ATS (Zener)', 5),
  ('ATS', 0),
  ('Flesan', 22),
  ('ATS (Kolff Spa)', 4),
  ('ATS (Elecnor)', 1),
  ('Lombac', 29),
  ('Inversiones Casacuberta', 10)
) as v(nombre, dias)
where c.nombre = v.nombre;

-- --- La fecha estimada se calcula sola ---------------------------------------
-- Solo cuando viene vacía: una fecha puesta a mano (un acuerdo puntual, una
-- promesa de pago) nunca se pisa.

create function public.set_fecha_estimada_pago()
returns trigger
language plpgsql
as $$
declare
  plazo integer;
begin
  if new.fecha_estimada_pago is null and new.fecha_facturacion is not null then
    select cl.dias_pago into plazo from public.clientes cl where cl.id = new.cliente_id;
    if plazo is not null then
      new.fecha_estimada_pago := new.fecha_facturacion + plazo;
    end if;
  end if;
  return new;
end;
$$;

create trigger set_fecha_estimada_pago_ventas
  before insert or update on public.ventas_servicios
  for each row execute procedure public.set_fecha_estimada_pago();

-- Las ventas ya cargadas no pasaron por el trigger.
update public.ventas_servicios vs
set fecha_estimada_pago = vs.fecha_facturacion + cl.dias_pago
from public.clientes cl
where cl.id = vs.cliente_id
  and vs.fecha_estimada_pago is null
  and vs.fecha_facturacion is not null
  and cl.dias_pago is not null;

create index on public.ventas_servicios (fecha_pago, fecha_estimada_pago);

-- --- Cobranza -----------------------------------------------------------------
-- Facturado y todavía no cobrado. Es el espejo de v_calendario_pagos.

create view public.v_cobranza
with (security_invoker = true) as
select
  vs.id,
  vs.fecha_servicio,
  c.nombre as cliente,
  c.dias_pago,
  vs.n_factura,
  vs.fecha_facturacion,
  vs.fecha_estimada_pago,
  vs.total as monto,
  (vs.fecha_estimada_pago < current_date) as vencido,
  (vs.fecha_estimada_pago - current_date) as dias_restantes,
  date_trunc('month', coalesce(vs.fecha_estimada_pago, vs.fecha_facturacion))::date as mes_cobro
from public.ventas_servicios vs
join public.clientes c on c.id = vs.cliente_id
where vs.fecha_pago is null
  and vs.fecha_facturacion is not null;

comment on view public.v_cobranza is
  'Ventas facturadas y aún no cobradas, con la fecha estimada de pago del cliente.';

-- --- Flujo de caja proyectado --------------------------------------------------
-- Entradas y salidas en una sola serie mensual. Los montos van con IVA porque
-- esto es caja, no resultado: lo que entra y sale de la cuenta es el total.

create view public.v_flujo_caja
with (security_invoker = true) as
select
  mes_cobro as mes,
  'entrada'::text as direccion,
  sum(monto) as monto,
  count(*) as documentos
from public.v_cobranza
where mes_cobro is not null
group by 1
union all
select
  mes_pago,
  'salida'::text,
  sum(total),
  count(*)
from public.v_calendario_pagos
where mes_pago is not null
group by 1;

comment on view public.v_flujo_caja is
  'Cobranza esperada contra compromisos de pago, por mes. Es proyección, no caja real: no incluye el saldo bancario ni las cuotas de leasing, que todavía no se modelan.';
