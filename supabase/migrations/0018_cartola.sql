-- ============================================================================
-- ATS SAAS · Fase 3 · Importación de cartola bancaria
--
-- Dos tablas:
--
--   reglas_clasificacion  el diccionario que aprende. Cada vez que se clasifica
--                         un RUT o una glosa, la regla queda guardada y la
--                         próxima cartola la reconoce sola.
--   cartola_movimientos   el staging. La cartola se importa aquí, se revisa, y
--                         recién entonces se escribe en gastos_*. Reproduce el
--                         flujo de la hoja "Propuesta_Cartola" del Excel.
--
-- Las cartolas del banco se traslapan entre descargas: la clave única
-- (fecha, glosa, monto, tipo) hace que re-importar un período ya cargado no
-- duplique nada.
-- ============================================================================

-- --- Diccionario de clasificación -------------------------------------------

-- 'excluir' es tan importante como los otros dos: los traspasos al socio y los
-- pagos de facturas ya registradas NO son gastos, y sin esta categoría se
-- contarían dos veces.
create type public.destino_gasto as enum ('operacional', 'administrativo', 'excluir');

create table public.reglas_clasificacion (
  id uuid primary key default gen_random_uuid(),
  -- RUT sin puntos ni guion, o fragmento de glosa en minúsculas sin tildes.
  patron text not null unique,
  etiqueta text not null,
  proveedor text,
  destino public.destino_gasto not null,
  categoria_costo_id uuid references public.categorias_costo (id) on delete set null,
  con_iva boolean not null default true,
  nota text,
  veces_aplicada integer not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.reglas_clasificacion (destino);

comment on table public.reglas_clasificacion is
  'Diccionario RUT/glosa -> categoría. Lo alimenta el importador de cartola: cada clasificación manual queda aquí y se reutiliza en la siguiente importación.';

create trigger set_updated_at_reglas_clasificacion
  before update on public.reglas_clasificacion
  for each row execute procedure public.set_updated_at();

create trigger audit_reglas_clasificacion
  after insert or update or delete on public.reglas_clasificacion
  for each row execute procedure public.audit_trigger_fn();

-- --- Movimientos de la cartola ----------------------------------------------

create table public.cartola_movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  glosa text not null,
  monto numeric(14, 2) not null,
  tipo text not null check (tipo in ('cargo', 'abono')),
  saldo numeric(14, 2),
  rut text,
  archivo text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'registrado', 'descartado')),
  regla_id uuid references public.reglas_clasificacion (id) on delete set null,
  gasto_operacional_id uuid references public.gastos_operacionales (id) on delete set null,
  gasto_administrativo_id uuid references public.gastos_administrativos (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  -- Las descargas de cartola se traslapan: sin esto, cada re-importación
  -- duplicaría los movimientos del período compartido.
  unique (fecha, glosa, monto, tipo)
);

create index on public.cartola_movimientos (estado);
create index on public.cartola_movimientos (fecha desc);
create index on public.cartola_movimientos (rut);

comment on table public.cartola_movimientos is
  'Staging de la cartola bancaria. Un movimiento solo afecta el resultado cuando se registra como gasto; mientras tanto queda pendiente y a la vista.';

create trigger audit_cartola_movimientos
  after insert or update or delete on public.cartola_movimientos
  for each row execute procedure public.audit_trigger_fn();

-- --- RLS ---------------------------------------------------------------------
-- Mismo criterio que gastos: lectura para cualquier autenticado, escritura
-- para admin y operador, borrado solo admin.

alter table public.reglas_clasificacion enable row level security;
alter table public.cartola_movimientos enable row level security;

create policy "reglas_select_authenticated"
  on public.reglas_clasificacion for select
  using (auth.uid() is not null);

create policy "reglas_insert_admin_operador"
  on public.reglas_clasificacion for insert
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "reglas_update_admin_operador"
  on public.reglas_clasificacion for update
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "reglas_delete_admin_only"
  on public.reglas_clasificacion for delete
  using (public.current_user_role() = 'admin');

create policy "cartola_select_authenticated"
  on public.cartola_movimientos for select
  using (auth.uid() is not null);

create policy "cartola_insert_admin_operador"
  on public.cartola_movimientos for insert
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "cartola_update_admin_operador"
  on public.cartola_movimientos for update
  using (public.current_user_role() in ('admin', 'operador'))
  with check (public.current_user_role() in ('admin', 'operador'));

create policy "cartola_delete_admin_only"
  on public.cartola_movimientos for delete
  using (public.current_user_role() = 'admin');

-- --- Reglas iniciales --------------------------------------------------------
-- Diccionario ya aprendido en la conciliación de cartolas Santander del Excel
-- (hoja "Claude Log", turnos 4 a 12). Evita volver a clasificar a mano lo que
-- ya se resolvió una vez.

insert into public.reglas_clasificacion (patron, etiqueta, proveedor, destino, categoria_costo_id, con_iva, nota)
select v.patron, v.etiqueta, v.proveedor, v.destino::public.destino_gasto, cc.id, v.con_iva, v.nota
from (values
  ('760248835', 'Aguilera Transportes', 'Aguilera Transportes', 'operacional',
   'Servicios_Externos', 'Transporte', true,
   'Suele pagar facturas ya registradas: revisar que no se duplique el gasto'),
  ('103798728', 'Eduardo Navarrete', 'Eduardo Navarrete', 'operacional',
   'Sueldos', 'Operadores', false, null),
  ('142796414', 'Elton Urbina', 'Elton Urbina', 'operacional',
   'Servicios_Externos', 'Camión Pluma', true, null),
  ('163822628', 'Pablo Muñoz', 'Pablo Muñoz', 'administrativo',
   'Honorarios', 'Prevencionista', false, null),
  ('192388589', 'Mario Aguilera (socio)', null, 'excluir',
   null, null, false,
   'Aporte o retiro del socio: va a cuenta socio, no es gasto del mes'),
  ('copec', 'Copec', 'Copec', 'operacional',
   'Combustible', 'Diésel', true, null),
  ('previred', 'Previred', 'Previred', 'operacional',
   'Sueldos', 'Previred', false, null),
  ('servipag', 'Servipag (peajes/TAG)', 'Servipag', 'operacional',
   'Peajes_Circulación', 'Autopistas_urbanas', true,
   'Supuesto heredado del Excel: se carga CON IVA. Validar con la boleta'),
  ('poblete godoy', 'Constanza Godoy', 'Poblete Godoy Const.', 'administrativo',
   'Honorarios', 'Administrativo', false, null)
) as v(patron, etiqueta, proveedor, destino, categoria, subcategoria, con_iva, nota)
left join public.categorias_costo cc
  on cc.categoria = v.categoria and cc.subcategoria = v.subcategoria
on conflict (patron) do nothing;
