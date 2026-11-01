-- ============================================================================
-- ATS SAAS · Fase 3 · Reglas de clasificación derivadas del histórico
--
-- Se intentó derivarlas automáticamente de la columna "proveedor" de
-- Gastos_Operacionales (295 filas). No sirve: esa columna describe a quién se
-- le pagó en lenguaje humano ("Ferretería San Francisco", "Importadora y
-- comercializadora"), mientras el banco usa su propio vocabulario truncado
-- ("0795184309 Transf a Agroparts Ltda"). Son dos idiomas distintos.
--
-- Peor aún, varias reglas automáticas habrían clasificado mal en silencio:
--   mantencion -> Gastos_Bancarios     choca con la mantención del camión
--   camion     -> Seguros              aparece en cualquier glosa del camión
--   talagante  -> Combustible          es un lugar, no un proveedor
--   rodrigo    -> Viáticos (59%)       sus giros grandes son sueldo
--
-- Así que estas reglas salen de las GLOSAS REALES de la cartola de octubre,
-- cruzadas con el histórico del Excel para saber la categoría. Cada una se
-- verificó contra un movimiento concreto.
--
-- Requiere 0018 aplicada.
-- ============================================================================

insert into public.reglas_clasificacion (patron, etiqueta, proveedor, destino, categoria_costo_id, con_iva, nota)
select v.patron, v.etiqueta, v.proveedor, v.destino::public.destino_gasto, cc.id, v.con_iva, v.nota
from (values
  -- Personas: el RUT es el identificador, nunca el nombre. El banco trunca la
  -- glosa ("Transf a Camilo Alejand") y los nombres de pila colisionan.
  ('165171896', 'Rodrigo Núñez', 'Rodrigo Núñez', 'operacional',
   'Sueldos', 'Operadores', false,
   'Los giros grandes son sueldo; los de pocos miles suelen ser viáticos: revisar el monto'),
  ('170827791', 'Camilo Chávez', 'Camilo Chávez', 'operacional',
   'Sueldos', 'Ayudantes', false, null),
  ('196567291', 'Marco Muñoz', 'Marco Muñoz', 'operacional',
   'Sueldos', 'Ayudantes', false, null),

  -- Empresas que aparecen con RUT en la glosa.
  ('761784935', 'Porsche Quilicura', 'Porsche Quilicura', 'operacional',
   'Mantención', 'Preventiva', true, null),
  ('795184309', 'Agroparts Ltda', 'Agroparts Ltda', 'operacional',
   'Repuestos', 'Accesorios', true, null),

  -- Cargos que el banco identifica por texto, sin RUT.
  ('pago en linea s.i.i.', 'Pago al SII', 'Tesorería / SII', 'administrativo',
   'Otros_Administrativos', 'Pago_IVA', false,
   'Pago de impuestos: es flujo de caja, el EERR lo deja fuera del resultado'),
  ('com.mantencion plan', 'Mantención cuenta Santander', 'Banco Santander', 'administrativo',
   'Gastos_Bancarios', 'Mantenciones_de_cuenta', false, null),
  ('dp *seguros', 'DP Seguros', 'DP Seguros', 'administrativo',
   'Seguros', 'Seguro_vehículos', false, null),
  ('reale', 'Reale Seguros', 'Reale Seguros', 'administrativo',
   'Seguros', 'Seguro_vehículos', false, null),

  -- Proveedores recurrentes del Excel cuyo nombre sí aparecería en una glosa.
  ('agroparts', 'Agroparts Ltda', 'Agroparts Ltda', 'operacional',
   'Repuestos', 'Accesorios', true, null),
  ('porsche', 'Porsche Quilicura', 'Porsche Quilicura', 'operacional',
   'Mantención', 'Preventiva', true, null),
  ('ferreteria', 'Ferretería', null, 'operacional',
   'Mantención', 'Correctiva', true, null),
  ('neumaticos', 'Neumáticos', null, 'operacional',
   'Repuestos', 'Neumáticos', true, null),
  ('notaria', 'Notaría', null, 'administrativo',
   'Honorarios', 'Notaría', false, null)
) as v(patron, etiqueta, proveedor, destino, categoria, subcategoria, con_iva, nota)
left join public.categorias_costo cc
  on cc.categoria = v.categoria and cc.subcategoria = v.subcategoria
on conflict (patron) do nothing;
