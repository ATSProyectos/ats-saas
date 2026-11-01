-- ============================================================================
-- ATS SAAS · Fase 3 · Documentos tributarios electrónicos (XML del SII)
--
-- El XML es mejor fuente que la cartola: trae el RUT del emisor limpio, el
-- neto y el IVA exactos y el folio, sin depender de la glosa truncada del
-- banco ni de desagregar el IVA hacia atrás.
--
-- Relación con la cartola: la factura es el DEVENGO y el cargo bancario es el
-- PAGO del mismo gasto. El EERR trabaja devengado, así que manda la factura;
-- registrar además el cargo contaría el gasto dos veces. Por eso /cartola
-- avisa cuando un cargo pendiente calza con un documento ya registrado.
-- ============================================================================

create table public.documentos_sii (
  id uuid primary key default gen_random_uuid(),
  -- Clave natural del DTE: un folio es único por emisor y tipo de documento.
  rut_emisor text not null,
  tipo_dte integer not null,
  folio integer not null,
  razon_social text,
  fecha_emision date not null,
  monto_neto numeric(14, 2) not null default 0,
  monto_exento numeric(14, 2) not null default 0,
  iva numeric(14, 2) not null default 0,
  monto_total numeric(14, 2) not null default 0,
  -- Las notas de crédito anulan o rebajan: entran con signo negativo para que
  -- la suma de documentos sea el costo real del período.
  signo smallint not null default 1 check (signo in (1, -1)),
  detalle text,
  archivo text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'registrado', 'descartado')),
  gasto_operacional_id uuid references public.gastos_operacionales (id) on delete set null,
  gasto_administrativo_id uuid references public.gastos_administrativos (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (rut_emisor, tipo_dte, folio)
);

create index on public.documentos_sii (estado);
create index on public.documentos_sii (fecha_emision desc);
create index on public.documentos_sii (rut_emisor);

comment on table public.documentos_sii is
  'Facturas y boletas de compra leídas desde el XML del SII. Un documento solo afecta el resultado cuando se registra como gasto.';

comment on column public.documentos_sii.signo is
  'Las notas de crédito (tipo 61) entran en -1: rebajan el costo en vez de sumarlo.';

create trigger audit_documentos_sii
  after insert or update or delete on public.documentos_sii
  for each row execute procedure public.audit_trigger_fn();

-- --- RLS ---------------------------------------------------------------------

alter table public.documentos_sii enable row level security;

create policy "documentos_sii_select_authenticated"
  on public.documentos_sii for select
  using (auth.uid() is not null);

create policy "documentos_sii_insert_admin_operador"
  on public.documentos_sii for insert
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "documentos_sii_update_admin_operador"
  on public.documentos_sii for update
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "documentos_sii_delete_admin_only"
  on public.documentos_sii for delete
  using (public.current_user_role() = 'admin');

-- --- Cargos de cartola que podrían ser pago de una factura ya registrada -----
-- Mismo RUT, monto parecido y fecha cercana. No decide nada: solo deja a la
-- vista los casos donde registrar el cargo duplicaría un gasto.

create view public.v_cartola_posible_duplicado
with (security_invoker = true) as
select
  cm.id as movimiento_id,
  cm.fecha as fecha_cargo,
  cm.glosa,
  cm.monto as monto_cargo,
  d.id as documento_id,
  d.tipo_dte,
  d.folio,
  d.razon_social,
  d.fecha_emision,
  d.monto_total
from public.cartola_movimientos cm
join public.documentos_sii d
  on d.rut_emisor = cm.rut
 and d.estado = 'registrado'
 and abs(d.monto_total - cm.monto) <= greatest(round(cm.monto * 0.02), 1000)
 and d.fecha_emision between cm.fecha - interval '90 days' and cm.fecha + interval '15 days'
where cm.estado = 'pendiente'
  and cm.tipo = 'cargo'
  and cm.rut is not null;

comment on view public.v_cartola_posible_duplicado is
  'Cargos pendientes que calzan con una factura ya registrada: la factura es el devengo y el cargo es su pago, registrar ambos contaría el gasto dos veces.';
