-- ============================================================================
-- ATS SAAS · Fase 3.1 · Estado de resultados mensual: catálogo y mapeo
--
-- Alcance acordado: niveles 1 a 4, hasta EBITDA. Sin depreciación, gastos
-- financieros ni impuesto a la renta (quedan para una fase posterior, que
-- necesita tablas de activo fijo y de financiamiento).
--
-- Criterio de reconocimiento: DEVENGADO.
--   · Ingresos y costos directos -> fecha_servicio del servicio.
--   · Gastos operacionales y administrativos -> su fecha de devengo.
-- El EERR es un reporte de resultado, no de caja: montos NETOS (sin IVA).
--
-- Dos tablas de configuración, para que el reporte se ajuste con un UPDATE y
-- no con un cambio de código:
--   · eerr_lineas  -> qué líneas existen, en qué orden y a qué grupo suman.
--   · eerr_mapeo   -> a qué línea va cada categoría de costo.
-- ============================================================================

-- --- Catálogo de líneas del EERR --------------------------------------------
-- grupo define cómo participa la línea en los subtotales:
--   ingresos | costo_directo | indirecto | gav | sin_clasificar | excluido
--   subtotal -> la línea ES un subtotal, se calcula en la vista.
-- Mover una línea de grupo (p. ej. 'costo_directo' -> 'excluido') la saca de
-- los subtotales sin tocar la aplicación.
create table public.eerr_lineas (
  codigo text primary key,
  nombre text not null,
  grupo text not null check (grupo in (
    'ingresos', 'costo_directo', 'indirecto', 'gav',
    'sin_clasificar', 'excluido', 'subtotal'
  )),
  orden int not null unique,
  tipo text not null check (tipo in ('detalle', 'subtotal')),
  nota text,
  created_at timestamptz not null default now()
);

comment on table public.eerr_lineas is
  'Líneas del estado de resultados mensual (hasta EBITDA). El orden y el grupo son configurables sin desplegar código.';

-- --- Mapeo categoría de costo -> línea del EERR ------------------------------
create table public.eerr_mapeo (
  id uuid primary key default gen_random_uuid(),
  categoria_costo_id uuid not null unique
    references public.categorias_costo (id) on delete cascade,
  linea_codigo text not null references public.eerr_lineas (codigo),
  nota text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index on public.eerr_mapeo (linea_codigo);

comment on table public.eerr_mapeo is
  'Una categoría de costo = una línea del EERR. Lo que no esté mapeado cae en la línea 0.0 (Sin clasificar) y queda visible en el panel de control, nunca se pierde en silencio.';

create trigger set_updated_at_eerr_mapeo
  before update on public.eerr_mapeo
  for each row execute procedure public.set_updated_at();

create trigger audit_eerr_mapeo
  after insert or update or delete on public.eerr_mapeo
  for each row execute procedure public.audit_trigger_fn();

-- --- RLS ---------------------------------------------------------------------
-- Lectura para cualquier usuario autenticado; escritura solo admin: cambiar el
-- mapeo cambia el resultado del mes, no es una edición operativa.
alter table public.eerr_lineas enable row level security;
alter table public.eerr_mapeo enable row level security;

create policy "eerr_lineas_select_authenticated"
  on public.eerr_lineas for select
  using (auth.uid() is not null);

create policy "eerr_lineas_write_admin_only"
  on public.eerr_lineas for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "eerr_mapeo_select_authenticated"
  on public.eerr_mapeo for select
  using (auth.uid() is not null);

create policy "eerr_mapeo_write_admin_only"
  on public.eerr_mapeo for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- --- Seed de líneas -----------------------------------------------------------
insert into public.eerr_lineas (codigo, nombre, grupo, orden, tipo, nota) values
  -- 1 · Ingresos de explotación (netos)
  ('1.1', 'Arriendo de pluma por hora',            'ingresos', 10, 'detalle', 'valor_pluma_hora x cantidad_horas'),
  ('1.2', 'Fletes y transporte',                   'ingresos', 20, 'detalle', 'valor_flete'),
  ('1.3', 'Rigger y maniobras',                    'ingresos', 30, 'detalle', 'rigger'),
  ('1.4', 'Extras y recargos',                     'ingresos', 40, 'detalle', 'extras'),
  ('T1',  'TOTAL INGRESOS NETOS',                  'subtotal', 60, 'subtotal', null),

  -- 2 · Costos directos de servicio
  ('2.1', 'Remuneración variable de operadores',   'costo_directo',  70, 'detalle', 'variable_operador'),
  ('2.2', 'Viáticos y gastos en ruta',             'costo_directo',  80, 'detalle', 'viaticos_extras'),
  ('2.3', 'Salidas de caja en obra',               'costo_directo',  90, 'detalle', 'salida_caja'),
  ('2.4', 'Combustible TCT',                       'costo_directo', 100, 'detalle', 'costos_petroleo_tct · lo imputa el módulo Combustible'),
  ('2.5', 'Combustible fuera de TCT',              'costo_directo', 110, 'detalle', 'costos_petroleo_sin_tct · lo imputa el módulo Combustible'),
  ('2.6', 'Peajes y TAG asignados a servicios',    'costo_directo', 120, 'detalle', 'tag_peajes · lo imputa el módulo Peajes'),
  ('2.7', 'Subcontratos y servicios de terceros',  'costo_directo', 130, 'detalle', 'pago_terceros'),
  ('2.8', 'IVA de facturas de terceros',           'costo_directo', 140, 'detalle', 'pago_iva_terceros · si ese IVA es crédito recuperable NO es costo: pasar esta línea a grupo excluido'),
  ('2.9', 'Comisiones de venta',                   'costo_directo', 150, 'detalle', 'comision_venta'),
  ('T2',  'TOTAL COSTOS DIRECTOS',                 'subtotal', 160, 'subtotal', null),
  ('T3',  'MARGEN BRUTO',                          'subtotal', 170, 'subtotal', 'T1 - T2'),

  -- 3 · Costos indirectos de operación (flota y equipos)
  ('3.1',  'Mantención preventiva',                      'indirecto', 180, 'detalle', null),
  ('3.2',  'Mantención correctiva',                      'indirecto', 190, 'detalle', null),
  ('3.3',  'Repuestos y neumáticos',                     'indirecto', 200, 'detalle', null),
  ('3.4',  'Combustible no asignado a servicios',        'indirecto', 210, 'detalle', 'consumos_combustible sin venta_servicio_id'),
  ('3.5',  'Peajes y TAG no asignados a servicios',      'indirecto', 220, 'detalle', 'peajes_tag sin venta_servicio_id'),
  ('3.6',  'Remuneraciones fijas operativas',            'indirecto', 230, 'detalle', 'sueldos, leyes sociales y gratificaciones del personal de operación'),
  ('3.7',  'Seguros de vehículos y responsabilidad civil','indirecto', 240, 'detalle', null),
  ('3.8',  'Permisos, revisión técnica y certificaciones','indirecto', 250, 'detalle', null),
  ('3.9',  'Uniformes y EPP',                            'indirecto', 260, 'detalle', null),
  ('3.10', 'Arriendo de maquinaria y transporte externo', 'indirecto', 270, 'detalle', 'subcontratos no imputados a un servicio puntual'),
  ('3.11', 'Otros costos operacionales no asignados',    'indirecto', 280, 'detalle', null),
  ('T4',   'TOTAL COSTOS INDIRECTOS DE OPERACIÓN',       'subtotal',  290, 'subtotal', null),
  ('T5',   'RESULTADO OPERACIONAL DE FLOTA',             'subtotal',  300, 'subtotal', 'T3 - T4'),

  -- 4 · Gastos de administración y ventas
  ('4.1',  'Remuneraciones de administración',      'gav', 310, 'detalle', null),
  ('4.2',  'Honorarios profesionales',              'gav', 320, 'detalle', null),
  ('4.3',  'Arriendos de oficina, bodega y terreno','gav', 330, 'detalle', null),
  ('4.4',  'Servicios básicos',                     'gav', 340, 'detalle', null),
  ('4.5',  'Software y licencias',                  'gav', 350, 'detalle', null),
  ('4.6',  'Publicidad y marketing',                'gav', 360, 'detalle', null),
  ('4.7',  'Capacitación',                          'gav', 370, 'detalle', null),
  ('4.8',  'Seguros de empresa',                    'gav', 380, 'detalle', null),
  ('4.9',  'Gastos y comisiones bancarias',         'gav', 390, 'detalle', null),
  ('4.10', 'Papelería, representación y otros administrativos', 'gav', 400, 'detalle', null),
  ('T6',   'TOTAL GASTOS DE ADMINISTRACIÓN Y VENTAS','subtotal', 410, 'subtotal', null),

  -- Costos cargados sin mapeo: restan del EBITDA y quedan a la vista.
  ('0.0',  'Sin clasificar (revisar mapeo)',        'sin_clasificar', 420, 'detalle', 'gastos cuya categoría no tiene línea asignada en eerr_mapeo'),
  ('T7',   'EBITDA',                                'subtotal', 430, 'subtotal', 'T5 - T6 - sin clasificar'),

  -- Fuera del resultado, visibles solo en el panel de control.
  ('X.1',  'Excluido · ya está en los costos directos del servicio', 'excluido', 440, 'detalle', 'combustible y peajes que llegan por sus módulos; cargarlos también como gasto los contaría dos veces'),
  ('X.2',  'Excluido · no es resultado (IVA, PPM, impuestos)',        'excluido', 450, 'detalle', 'el pago de IVA y los PPM son flujo de caja, no gasto del mes'),
  ('X.3',  'Excluido · inversión en activo fijo (CAPEX)',            'excluido', 460, 'detalle', 'entra al resultado como depreciación en la fase 2, no como gasto del mes');

-- --- Categorías que faltaban para que la línea 3.8 sea utilizable -----------
insert into public.categorias_costo (categoria, subcategoria) values
  ('Permisos y Certificaciones', 'Revisión técnica'),
  ('Permisos y Certificaciones', 'Permiso de circulación'),
  ('Permisos y Certificaciones', 'Certificación de equipos'),
  ('Remuneraciones Administración', 'Sueldos administración'),
  ('Remuneraciones Administración', 'Leyes sociales')
on conflict (categoria, subcategoria) do nothing;

-- --- Seed del mapeo -----------------------------------------------------------
-- Reglas por categoría (subcategoría null = toda la categoría). Si una
-- categoría calza con una regla general y con una específica, gana la
-- específica.
with reglas (categoria, subcategoria, linea, nota) as (
  values
    -- Duplicarían un costo directo que ya entra por su módulo.
    ('Combustible', 'Diésel'::text, 'X.1', 'lo carga el módulo Combustible'::text),
    ('Combustible', 'Gasolina', 'X.1', 'lo carga el módulo Combustible'),
    ('Combustible', 'AdBlue', '3.11', null),
    ('TAG y Peajes', 'Autopistas urbanas', 'X.1', 'lo carga el módulo Peajes'),
    ('TAG y Peajes', 'Rutas interurbanas', 'X.1', 'lo carga el módulo Peajes'),
    ('TAG y Peajes', 'Multas por TAG', '3.11', 'una multa no es peaje'),
    -- Operación de flota y equipos.
    ('Mantención', null, '3.2', null),
    ('Mantención', 'Preventiva', '3.1', null),
    ('Mantención', 'Lubricantes', '3.1', null),
    ('Repuestos', null, '3.3', null),
    ('Sueldos Operativos', null, '3.6', null),
    ('Viáticos', null, '3.11', 'los viáticos de un servicio puntual van en la venta (línea 2.2)'),
    ('Seguros', 'Seguro vehículos', '3.7', null),
    ('Seguros', 'Responsabilidad civil', '3.7', null),
    ('Capacitación', 'Certificación Pluma', '3.8', 'certificación del equipo, no formación'),
    ('Permisos y Certificaciones', null, '3.8', null),
    ('Uniformes y EPP', null, '3.9', null),
    ('Arriendo Maquinaria', null, '3.10', null),
    ('Transporte Externo', null, '3.10', null),
    ('Servicios Externos', null, '3.10', null),
    ('Otros Operacionales', null, '3.11', null),
    ('Herramientas', null, '3.11', null),
    -- Administración y ventas.
    ('Remuneraciones Administración', null, '4.1', null),
    ('Honorarios', null, '4.2', null),
    ('Arriendos', null, '4.3', null),
    ('Servicios Básicos', null, '4.4', null),
    ('Software y Licencias', null, '4.5', null),
    ('Publicidad y Marketing', null, '4.6', null),
    ('Capacitación', null, '4.7', null),
    ('Seguros', 'Seguro empresa', '4.8', null),
    ('Seguros', null, '4.8', null),
    ('Gastos Bancarios', null, '4.9', null),
    ('Papelería y Útiles', null, '4.10', null),
    ('Representación', null, '4.10', null),
    ('Otros Administrativos', 'Gastos menores', '4.10', null),
    -- Fuera del resultado.
    ('Otros Administrativos', 'Pago IVA', 'X.2', 'es flujo de caja, no gasto'),
    ('Otros Administrativos', null, '4.10', null),
    ('Vehículos', null, 'X.3', null),
    ('Equipos de Izaje', null, 'X.3', null),
    ('Infraestructura', null, 'X.3', null),
    ('Equipamiento TI', null, 'X.3', null),
    ('Software', null, 'X.3', 'compra de software; las suscripciones van en 4.5'),
    -- Estas son tipos de servicio que quedaron en el catálogo de costos: si
    -- aparece un gasto con ellas, hay que corregir la carga.
    ('Transporte especializado', null, '0.0', 'es un tipo de servicio, no una categoría de costo'),
    ('Izaje y montaje', null, '0.0', 'es un tipo de servicio, no una categoría de costo'),
    ('Ingeniería de apoyo', null, '0.0', 'es un tipo de servicio, no una categoría de costo'),
    ('Arriendo con operador', null, '0.0', 'es un tipo de servicio, no una categoría de costo'),
    ('Otros servicios', null, '0.0', 'es un tipo de servicio, no una categoría de costo')
),
resueltas as (
  select distinct on (cc.id)
    cc.id as categoria_costo_id,
    r.linea,
    r.nota
  from public.categorias_costo cc
  join reglas r
    on r.categoria = cc.categoria
   and (r.subcategoria is null or r.subcategoria = cc.subcategoria)
  order by cc.id, (r.subcategoria is not null) desc
)
insert into public.eerr_mapeo (categoria_costo_id, linea_codigo, nota)
select categoria_costo_id, linea, nota from resueltas
on conflict (categoria_costo_id) do nothing;
