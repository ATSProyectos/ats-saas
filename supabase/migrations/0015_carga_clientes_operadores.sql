-- ============================================================================
-- ATS SAAS · Fase 3 · Clientes y operadores del Excel
-- Solo agrega los que faltan: ambas tablas tienen nombre unique.
-- Re-ejecutable.
-- ============================================================================

insert into public.clientes (nombre) values
  ('ATS'),
  ('ATS (Atp Fiber)'),
  ('ATS (Besalco)'),
  ('ATS (Cobra)'),
  ('ATS (Conmetal)'),
  ('ATS (Diperk)'),
  ('ATS (Elecnor)'),
  ('ATS (Finning)'),
  ('ATS (Kolff Spa)'),
  ('ATS (Neo Mineral S.A)'),
  ('ATS (Patricio Valenzuela)'),
  ('ATS (Transportes Santa Blanca Ltda)'),
  ('ATS (Zener)'),
  ('AcuTecno Spa (Drilling spa)'),
  ('Alumco'),
  ('Andes Solar'),
  ('Asesorias Informaticas MHT spa'),
  ('Asigmu'),
  ('Bernal (Finning)'),
  ('DS Petroleo Carol Díaz'),
  ('Flesan'),
  ('Francisco Zepeda'),
  ('Good Lighting Spa'),
  ('Inversiones Casacuberta'),
  ('Inversiones Casacuberta Spa'),
  ('Lombac'),
  ('Madelco'),
  ('Maq Drilling Spa'),
  ('Mountain Tech Spa (Drilling Spa)'),
  ('Relcon'),
  ('Sotralop Spa'),
  ('Subcargo'),
  ('Transportes Bajo zero'),
  ('Ulma')
on conflict (nombre) do nothing;

insert into public.operadores (nombre) values
  ('ATS'),
  ('Benjamin'),
  ('Benjamín Leiva'),
  ('Camilo Chavez'),
  ('Carlos Saez'),
  ('Cristian Galeas'),
  ('Eduardo Navarrete'),
  ('Externo'),
  ('Johnatan Molina'),
  ('Jose Cisternas'),
  ('Jose Cisternas / Mauricio'),
  ('Juan Puebla'),
  ('Luis Castillo'),
  ('Manuel Romero'),
  ('Mario Aguilera'),
  ('Mario Alejandro'),
  ('Mario Antonio'),
  ('Mauricio Gutierrez'),
  ('Pedro Olate'),
  ('Rodrigo Nuñez'),
  ('TERCERO')
on conflict (nombre) do nothing;
