-- ============================================================================
-- ATS SAAS · Fase 3 · Catálogo de costos alineado con el Excel de operación
--
-- El catálogo se sembró (0004) con nombres que no son los que usa el Excel
-- del día a día: 195 de 377 filas de gasto no encontraban su categoría.
-- Aquí se RENOMBRA, nunca se borra: eerr_mapeo apunta a categorias_costo con
-- on delete cascade, así que borrar y recrear dejaría el EERR sin clasificar.
--
-- Requiere 0012 aplicada (eerr_lineas / eerr_mapeo).
-- Re-ejecutable: los UPDATE no encuentran nada en la segunda pasada y los
-- INSERT llevan on conflict do nothing.
-- ============================================================================

-- --- 1) Categorías: misma idea, la escritura del Excel ----------------------
update public.categorias_costo set categoria = 'Servicios_Externos' where categoria = 'Servicios Externos';
update public.categorias_costo set categoria = 'Uniformes_EPP' where categoria = 'Uniformes y EPP';
update public.categorias_costo set categoria = 'Otros_Operacionales' where categoria = 'Otros Operacionales';
update public.categorias_costo set categoria = 'Otros_Administrativos' where categoria = 'Otros Administrativos';
update public.categorias_costo set categoria = 'Gastos_Bancarios' where categoria = 'Gastos Bancarios';
update public.categorias_costo set categoria = 'Publicidad_Marketing' where categoria = 'Publicidad y Marketing';
update public.categorias_costo set categoria = 'Sueldos' where categoria = 'Sueldos Operativos';
update public.categorias_costo set categoria = 'Peajes_Circulación' where categoria = 'TAG y Peajes';

-- --- 2) Subcategorías: guiones bajos y tildes como en el Excel --------------
update public.categorias_costo set subcategoria = 'Seguro_vehículos' where categoria = 'Seguros' and subcategoria = 'Seguro vehículos';
update public.categorias_costo set subcategoria = 'Mantenciones_de_cuenta' where categoria = 'Gastos_Bancarios' and subcategoria = 'Mantenciones de cuenta';
update public.categorias_costo set subcategoria = 'Autopistas_urbanas' where categoria = 'Peajes_Circulación' and subcategoria = 'Autopistas urbanas';
update public.categorias_costo set subcategoria = 'Gastos_menores' where categoria = 'Otros_Administrativos' and subcategoria = 'Gastos menores';
update public.categorias_costo set subcategoria = 'Pago_IVA' where categoria = 'Otros_Administrativos' and subcategoria = 'Pago IVA';
update public.categorias_costo set subcategoria = 'Supervisión_técnica' where categoria = 'Servicios_Externos' and subcategoria = 'Supervisión técnica';
update public.categorias_costo set subcategoria = 'Rutas_interurbanas' where categoria = 'Peajes_Circulación' and subcategoria = 'Rutas interurbanas';
update public.categorias_costo set subcategoria = 'Ropa_de_trabajo' where categoria = 'Uniformes_EPP' and subcategoria = 'Ropa de trabajo';
update public.categorias_costo set subcategoria = 'Cursos_licencias' where categoria = 'Capacitación' and subcategoria = 'Cursos y licencias';

-- --- 3) Combinaciones que el Excel usa y el catálogo no tenía ---------------
insert into public.categorias_costo (categoria, subcategoria) values
  ('Vehículos', 'Camión_Pluma'),
  ('Sueldos', 'Honorarios'),
  ('Otros_Administrativos', 'Sin especificar'),
  ('Servicios_Externos', 'Camión Pluma'),
  ('Sueldos', 'Previred'),
  ('Peajes_Circulación', 'Estacionamientos'),
  ('Otros_Operacionales', 'Exámenes'),
  ('Herramientas_operativas', 'Herramientas_operativas'),
  ('Sueldos', 'Exámenes'),
  ('Mantención', 'Soldadura'),
  ('Otros_Operacionales', 'Insumos Embalajes'),
  ('Peajes_Circulación', 'Peajes'),
  ('Mantención', 'Aire Acondicionado'),
  ('Sueldos', 'Administrativo'),
  ('Mantención', 'Hidráulico'),
  ('Mantención', 'Scanner'),
  ('Sueldos', 'Imposiciones'),
  ('Publicidad_Marketing', 'Publicidad_RRSS'),
  ('Capacitación', 'Certificación Operador'),
  ('Prestamo Bancario', 'ATS'),
  ('Herramientas_operativas', 'Equipos_izaje')
on conflict (categoria, subcategoria) do nothing;

-- --- 4) Línea del EERR para cada una ----------------------------------------
-- Sin esto caen en 0.0 "Sin clasificar" y restan del EBITDA sin explicación.
insert into public.eerr_mapeo (categoria_costo_id, linea_codigo, nota)
select cc.id, v.linea, v.nota
from (values
  ('Vehículos', 'Camión_Pluma', 'X.3', 'compra de activo fijo: entra como depreciación en la fase 2'),
  ('Sueldos', 'Honorarios', '3.6', null),
  ('Otros_Administrativos', 'Sin especificar', '4.10', '8 filas del Excel sin subcategoría: revisar y reclasificar'),
  ('Servicios_Externos', 'Camión Pluma', '3.10', 'arriendo de equipo externo no imputado a un servicio'),
  ('Sueldos', 'Previred', '3.6', 'leyes sociales del personal de operación'),
  ('Peajes_Circulación', 'Estacionamientos', '3.5', null),
  ('Otros_Operacionales', 'Exámenes', '3.8', 'exámenes ocupacionales'),
  ('Herramientas_operativas', 'Herramientas_operativas', 'X.3', 'compra de activo fijo'),
  ('Sueldos', 'Exámenes', '3.8', 'exámenes ocupacionales'),
  ('Mantención', 'Soldadura', '3.2', null),
  ('Otros_Operacionales', 'Insumos Embalajes', '3.11', null),
  ('Peajes_Circulación', 'Peajes', '3.5', null),
  ('Mantención', 'Aire Acondicionado', '3.2', null),
  ('Sueldos', 'Administrativo', '4.1', 'remuneración de administración, no de operación'),
  ('Mantención', 'Hidráulico', '3.2', null),
  ('Mantención', 'Scanner', '3.2', null),
  ('Sueldos', 'Imposiciones', '3.6', 'leyes sociales del personal de operación'),
  ('Publicidad_Marketing', 'Publicidad_RRSS', '4.6', null),
  ('Capacitación', 'Certificación Operador', '4.7', null),
  ('Prestamo Bancario', 'ATS', 'X.2', 'financiamiento: no es resultado del mes'),
  ('Herramientas_operativas', 'Equipos_izaje', 'X.3', 'compra de activo fijo')
) as v(categoria, subcategoria, linea, nota)
join public.categorias_costo cc
  on cc.categoria = v.categoria and cc.subcategoria = v.subcategoria
on conflict (categoria_costo_id) do nothing;
