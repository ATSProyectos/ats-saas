-- ============================================================================
-- ATS SAAS · Fase 3 · Catálogo de costos alineado con el Excel de operación
--
-- El catálogo se sembró (0004) con nombres que no son los que usa el Excel
-- del día a día: 195 de 377 filas de gasto no encontraban su categoría.
-- Aquí se RENOMBRA, nunca se borra: eerr_mapeo apunta a categorias_costo con
-- on delete cascade, así que borrar y recrear dejaría el EERR sin clasificar.
--
-- Requiere 0012 aplicada (eerr_lineas / eerr_mapeo).
-- Re-ejecutable: cada UPDATE se salta a si mismo si el nombre destino ya
-- existe (si no, re-sembrar 0004 resucitaria los nombres viejos y el rename
-- chocaria contra la restriccion unica), y los INSERT van con do nothing.
-- ============================================================================

-- --- 1) Categorías: misma idea, la escritura del Excel ----------------------
update public.categorias_costo c set categoria = 'Servicios_Externos'
 where c.categoria = 'Servicios Externos'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Servicios_Externos' and d.subcategoria = c.subcategoria);
update public.categorias_costo c set categoria = 'Uniformes_EPP'
 where c.categoria = 'Uniformes y EPP'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Uniformes_EPP' and d.subcategoria = c.subcategoria);
update public.categorias_costo c set categoria = 'Otros_Operacionales'
 where c.categoria = 'Otros Operacionales'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Otros_Operacionales' and d.subcategoria = c.subcategoria);
update public.categorias_costo c set categoria = 'Otros_Administrativos'
 where c.categoria = 'Otros Administrativos'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Otros_Administrativos' and d.subcategoria = c.subcategoria);
update public.categorias_costo c set categoria = 'Gastos_Bancarios'
 where c.categoria = 'Gastos Bancarios'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Gastos_Bancarios' and d.subcategoria = c.subcategoria);
update public.categorias_costo c set categoria = 'Publicidad_Marketing'
 where c.categoria = 'Publicidad y Marketing'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Publicidad_Marketing' and d.subcategoria = c.subcategoria);
update public.categorias_costo c set categoria = 'Sueldos'
 where c.categoria = 'Sueldos Operativos'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Sueldos' and d.subcategoria = c.subcategoria);
update public.categorias_costo c set categoria = 'Peajes_Circulación'
 where c.categoria = 'TAG y Peajes'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Peajes_Circulación' and d.subcategoria = c.subcategoria);

-- --- 2) Subcategorías: guiones bajos y tildes como en el Excel --------------
update public.categorias_costo c set subcategoria = 'Seguro_vehículos'
 where c.categoria = 'Seguros' and c.subcategoria = 'Seguro vehículos'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Seguros' and d.subcategoria = 'Seguro_vehículos');
update public.categorias_costo c set subcategoria = 'Mantenciones_de_cuenta'
 where c.categoria = 'Gastos_Bancarios' and c.subcategoria = 'Mantenciones de cuenta'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Gastos_Bancarios' and d.subcategoria = 'Mantenciones_de_cuenta');
update public.categorias_costo c set subcategoria = 'Autopistas_urbanas'
 where c.categoria = 'Peajes_Circulación' and c.subcategoria = 'Autopistas urbanas'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Peajes_Circulación' and d.subcategoria = 'Autopistas_urbanas');
update public.categorias_costo c set subcategoria = 'Gastos_menores'
 where c.categoria = 'Otros_Administrativos' and c.subcategoria = 'Gastos menores'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Otros_Administrativos' and d.subcategoria = 'Gastos_menores');
update public.categorias_costo c set subcategoria = 'Pago_IVA'
 where c.categoria = 'Otros_Administrativos' and c.subcategoria = 'Pago IVA'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Otros_Administrativos' and d.subcategoria = 'Pago_IVA');
update public.categorias_costo c set subcategoria = 'Supervisión_técnica'
 where c.categoria = 'Servicios_Externos' and c.subcategoria = 'Supervisión técnica'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Servicios_Externos' and d.subcategoria = 'Supervisión_técnica');
update public.categorias_costo c set subcategoria = 'Rutas_interurbanas'
 where c.categoria = 'Peajes_Circulación' and c.subcategoria = 'Rutas interurbanas'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Peajes_Circulación' and d.subcategoria = 'Rutas_interurbanas');
update public.categorias_costo c set subcategoria = 'Ropa_de_trabajo'
 where c.categoria = 'Uniformes_EPP' and c.subcategoria = 'Ropa de trabajo'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Uniformes_EPP' and d.subcategoria = 'Ropa_de_trabajo');
update public.categorias_costo c set subcategoria = 'Cursos_licencias'
 where c.categoria = 'Capacitación' and c.subcategoria = 'Cursos y licencias'
   and not exists (select 1 from public.categorias_costo d
                    where d.categoria = 'Capacitación' and d.subcategoria = 'Cursos_licencias');

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
