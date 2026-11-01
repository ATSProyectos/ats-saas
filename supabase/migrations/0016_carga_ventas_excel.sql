-- ============================================================================
-- ATS SAAS · Fase 3 · Ventas del Excel posteriores al 2026-07-09
--
-- La base ya tiene 255 servicios hasta el 2026-07-09. Aqui entran solo los
-- 67 posteriores: NO se borra ni se reemplaza nada. Borrar ventas pondria
-- en null las asignaciones de combustible y peajes (on delete set null).
--
-- monto_neto, iva, total, costos_directos y margen_bruto son columnas
-- generadas: se insertan los componentes, no los totales del Excel.
-- El Excel no tiene columna Rigger, asi que rigger queda en 0.
-- costos_petroleo_tct se carga con el valor del Excel; cuando se importe el
-- informe TCT el modulo Combustible lo recalcula y sobrescribe.
--
-- Quedan fuera: 1 fila sin fecha valida y 2 filas con fecha erronea
-- (2002-10-07 y 2016-10-15), anteriores al corte. Revisar en el Excel.
-- Re-ejecutable: el NOT EXISTS evita duplicar.
-- ============================================================================

begin;

create temp table _v_imp (
  fecha_servicio date, cliente text, proyecto_obra text, origen text, destino text,
  servicio_tipo text, comentario text, valor_pluma_hora numeric(14,2), cantidad_horas numeric(10,2),
  valor_flete numeric(14,2), extras numeric(14,2), n_guia text, n_oc text, descripcion_carga text,
  n_cotizacion text, n_factura text, fecha_facturacion date, fecha_estimada_pago date,
  fecha_pago date, operador text, variable_operador numeric(14,2), salida_caja numeric(14,2),
  viaticos_extras numeric(14,2), comision_venta numeric(14,2), pago_terceros numeric(14,2),
  pago_iva_terceros numeric(14,2), n_factura_tercero text, n_reporte text, km_inicio numeric(10,1),
  km_fin numeric(10,1), km_servicio numeric(10,1), costos_petroleo_tct numeric(14,2), h_operacion numeric(10,2),
  tag_peajes numeric(14,2)
) on commit drop;

insert into _v_imp values
  ('2026-07-13','Lombac','NA','Lampa','Linares','Pluma','Traslado de materiales',50000,8,350000,null,null,null,null,null,'172','2026-07-20','2026-08-19','2026-08-21','Rodrigo Nuñez',0,0,0,25000,0,0,null,null,null,null,0,336440,14,0),
  ('2026-07-14','Subcargo','Lo Campino','La Florida','Quilicura','Pluma','Traslado de materiales ida y vuelta La Florida',40000,7,20000,null,null,null,null,null,'173','2026-07-20','2026-08-19','2026-09-09','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,97057,8,0),
  ('2026-07-20','Andes Solar','Petalos','Viña del Mar','ATS Talagante','Pluma','Retiro de equipo eléctrico y custodia en sitio',50000,4,180000,null,'229107','13700',null,'841','179','2026-09-02','2026-10-02',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,104468,8,20000),
  ('2026-07-21','Andes Solar','Petalos','ATS Talagante','Petalos','Pluma','Despacho equipo eléctrico a proyecto',50000,5,null,null,'229107','13700',null,'841','179','2026-09-02','2026-10-02',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,66261,5,0),
  ('2026-07-23','Lombac','NA','Lampa','Linares','Pluma','Traslado de materiales',50000,8,350000,null,null,null,null,null,'174','2026-07-28','2026-08-27','2026-07-30','Rodrigo Nuñez',0,0,0,25000,0,0,null,null,null,null,0,333753,14,0),
  ('2026-07-24','Subcargo','Novatec','La Florida','San Joaquín','Pluma','Traslado de contenedor',40000,6,null,null,null,null,null,null,'175','2026-08-04','2026-09-03','2026-09-11','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,50692,6,0),
  ('2026-07-28','Subcargo','Lo Campino','La Florida','Quilicura','Pluma','Traslado de materiales ida y vuelta La Florida',40000,7,20000,null,null,null,null,null,'175','2026-08-04','2026-09-03','2026-09-11','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,107204,7,0),
  ('2026-07-22','Andes Solar','Petalos','Quilicura','Petalos','Camión 5 ton','RETIRO DE CARGA EN 3 PUNTOS PARA SER ENVIADOS A PROYECTO PETALOS, SAN BERNARDO 
OC: 13419 - MQ ARRIENDOS
OC: 13396 - ARAGON
OC: 13402 - ARAGON LIBERTADORES',null,null,140000,60000,'24563-178514-178513','13703',null,'842','180','2026-09-02','2026-10-02',null,'ATS',0,0,0,0,200000,38000,null,null,null,null,0,0,null,0),
  ('2026-07-22','Andes Solar','Petalos','Colina','San Bernardo','Camión 10 ton','RETIRO DE CARGA EN 3 PUNTOS PARA SER ENVIADOS A PROYECTO PETALOS, SAN BERNARDO 
OC: 13419 - MQ ARRIENDOS
OC: 13396 - ARAGON
OC: 13402 - ARAGON LIBERTADORES',null,null,140000,60000,'24563- 178514- 178513',null,null,'842','198','2026-09-21','2026-10-21',null,'ATS',0,0,0,0,200000,38000,null,null,null,null,0,0,null,0),
  ('2026-07-22','Andes Solar','Petalos','San Bernardo, Petalos','Quilicura','Camión 10 ton','RETIRO  Y TRASLADO DE 2 PLACA COMPACTADORAS + 1 RODILLO',null,null,140000,null,'878 - 879 // 24572 - 57930',null,null,'843','201','2026-09-21','2026-10-21',null,'ATS',0,0,0,0,132000,25080,null,null,null,null,0,0,null,0),
  ('2026-07-23','Andes Solar','Petalos','Con Con','ATS Talagante','Cama baja','RETIRO Y TRASLADO DE BODEGA ESPECIAL 9M2. Custodia en sitio 1 MES',null,null,680000,null,'1288 - 9393',null,null,'849','191','2026-09-09','2026-10-09',null,'ATS',0,0,0,0,680000,129200,null,null,null,null,0,0,null,0),
  ('2026-07-27','Andes Solar','Serapio / Parronal','Colina','Talca / Renaico','Rampla','RETIRO Y TRASLADO DE MATERIALES PARA SER ENTREGADOS EN PROYECTOS 
POLYTEX OC: 13432 // 12262',null,null,1450000,null,'159191-3009285-2968867-2968861-257976-577-159192-2006-968538-12175-7119-258403','13699',null,'844','181','2026-09-02','2026-10-02',null,'ATS',0,0,0,0,1397000,265430,null,null,null,null,0,0,null,0),
  ('2026-07-27','Andes Solar','Serapio / Parronal','Huechuraba','ATS Talagante','Camión 5 ton','BODEGA HUECHURABA OC: 13123, 13427, 13425, 13412 Y 13384 // 13355, 13379, 13407 y 13372',null,null,140000,null,null,'13699',null,'844','181','2026-09-02','2026-10-02',null,'ATS',0,0,0,0,132000,25080,null,null,null,null,0,0,null,0),
  ('2026-07-29','Andes Solar','NA','Paine','Paine','Pluma','Movimiento internos de materiales',50000,5,null,null,null,'13702',null,'845','182','2026-09-02','2026-10-02',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,63024,6,0),
  ('2026-08-03','Andes Solar','Petalos','San Bernardo','Quilicura','Camión 5 ton','Retiro torres a MQ y retorno a proyecto',null,null,140000,60000,null,'13701',null,'846','183','2026-09-02','2026-10-02',null,'ATS',0,0,0,0,198000,37620,null,null,null,null,0,0,null,0),
  ('2026-08-05','Andes Solar','Petalos','San Bernardo','Peñaflor','Pluma','Retiro hincadora a peñaflor',50000,8,null,null,null,'13706',null,'847','184','2026-09-02','2026-10-02',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,76217,8,0),
  ('2026-08-06','Flesan','SE Providencia','Lampa','Providencia','Pluma','Traslado contenedor y movimientos obra',50000,8,null,null,null,'114',null,null,'178','2026-08-20','2026-09-19','2026-09-11','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,117231,9.5,25000),
  ('2026-08-11','Lombac','NA','Lampa','Colina','Pluma','Traslado de materiales obra',43000,10,null,null,null,null,null,null,'177','2026-08-18','2026-09-17','2026-09-16','Rodrigo Nuñez',0,0,0,20000,0,0,null,null,null,null,0,145330,9.5,0),
  ('2026-08-12','Flesan','SE Providencia','Lampa','Providencia','Pluma','Traslado contenedor y movimientos obra',50000,8,null,null,null,'114',null,null,'178','2026-08-20','2026-09-19','2026-09-11','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,114270,9.5,0),
  ('2026-08-14','Subcargo','Flesan','Maipù','Maipù','Pluma','Traslado de materiales obra',43333.333333333336,6,null,null,null,null,null,null,'176','2026-08-18','2026-09-17','2026-09-25','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,75276,6,0),
  ('2026-08-18','Subcargo','CONSTRUCTORA RIC','San Bernardo','Las Condes','Pluma','Traslado de materiales obra',50000,5,null,null,null,null,null,null,'185','2026-09-03','2026-10-03','2026-10-09','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,80521.5,6,0),
  ('2026-08-19','Subcargo','CONSTRUCTORA RIC','San Bernardo','Puente Alto','Pluma','Traslado de materiales obra',50000,5,null,null,null,null,null,null,'185','2026-09-03','2026-10-03','2026-10-09','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,80521.5,6,0),
  ('2026-08-20','ATS','Finning','San Antonio','Enea Pudahuel','Camión 10 ton','Traslado de equipo',null,null,350000,null,'818705',null,null,null,'186','2026-09-04','2026-10-04','2026-09-04','Rodrigo Nuñez',0,0,10000,0,0,0,null,null,null,null,0,140481,8,0),
  ('2026-08-24','Subcargo','Maqsa','Renca','Puente Alto','Pluma','Traslado de contenedor',48000,5,null,null,null,null,null,null,'185','2026-09-03','2026-10-03','2026-10-09','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,134410,5,0),
  ('2026-08-12','Andes Solar','Petalos','Petalos','Quilicura','Camión 5 ton','Traslado de torres de iluminación, ida y vuelta a MQ proveedor',null,null,140000,60000,'58057 - 24735',null,null,'852','194','2026-09-09','2026-10-09',null,'ATS',0,0,0,0,198000,37620,null,null,null,null,0,0,null,0),
  ('2026-08-24','Andes Solar','NA','Paine','Paine','Pluma','Traslado de materiales obra',50000,5,null,null,null,null,null,'848','200','2026-09-21','2026-10-21',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,0,5,0),
  ('2026-08-25','Andes Solar','Petalos','Vitel','Petalos','Camión 10 ton','RETIRO Y TRASLADO DE OC 13588 VITEL NV 2708976 OC 13587 VITEL NV 2708978',null,null,150000,140000,'580413 - 580445 - 580443',null,null,'851','193','2026-09-09','2026-10-09',null,'ATS',0,0,0,0,0,0,null,null,null,null,0,0,null,0),
  ('2026-08-26','Andes Solar','Petalos','Petalos','Quilicura','Camión 5 ton','RETIRO Y TRASLADO DE UNA TORRE ILUMINARIA DESDE PROYECTO PETALOS HASTA MQ ARRIENDO LAMPA , CON RETORNO A SAN BERNARDO',null,null,140000,60000,'24836- 887- 58154',null,null,'850','192','2026-09-09','2026-10-09',null,'ATS',0,0,0,0,0,0,null,null,null,null,0,0,null,0),
  ('2026-08-25','ATS','Diperk','Conmetal Pudahuel','Renca','Camión 10 ton','Traslado de equipo',null,null,144000,null,'2792',null,null,null,'187','2026-09-04','2026-10-04','2026-09-04','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,58325,0,0),
  ('2026-08-26','ATS','Diperk','Quilicura','Maipú','Pluma','Traslado de equipo',50000,5,null,null,'1946234',null,null,null,'188','2026-09-04','2026-10-04','2026-09-04','Rodrigo Nuñez',0,0,0,10000,0,0,null,null,null,null,0,60634,5,0),
  ('2026-09-01','Flesan','SE Providencia','Lampa','Providencia','Pluma','Traslado contenedor y movimientos obra',50000,8,null,null,null,'114',null,null,'189','2026-09-04','2026-10-04','2026-10-16','Rodrigo Nuñez',0,0,0,0,0,0,null,'361',null,null,0,99253,10,0),
  ('2026-09-03','Flesan','SE Providencia','Lampa','Providencia','Pluma','Traslado contenedor y movimientos obra',50000,8,null,null,'27037','114',null,null,'189','2026-09-04','2026-10-04','2026-10-16','Rodrigo Nuñez',0,0,0,0,0,0,null,'362',null,null,0,135646,10,0),
  ('2026-09-03','Alumco','Vivaceta','Rancagua','Vivaceta','Camión 10 ton','Traslado de equipos aluminio',null,null,330000,null,null,null,null,null,'190','2026-09-08','2026-10-08','2026-09-08','ATS',0,0,0,0,290000,55100,null,null,null,null,0,0,null,0),
  ('2026-09-07','Subcargo','Flesan','Maipú','Maipú','Pluma','Movimientos internos de obra',38750,8,null,40000,null,null,null,null,'197','2026-09-20','2026-10-20',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,'363',null,null,0,102840,10,0),
  ('2026-09-08','Subcargo','Flesan','Maipú','Maipú','Pluma','Movimientos internos de obra',38750,8,null,null,null,null,null,null,'197','2026-09-20','2026-10-20',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,114323,10,0),
  ('2026-09-09','Flesan','SE Providencia','Lampa','Providencia','Pluma','Traslado contenedor y movimientos obra',50000,8,null,null,null,'114',null,null,'202','2026-09-24','2026-10-24','2026-10-16','Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,108988,10,0),
  ('2026-09-09','Inversiones Casacuberta','CCU Quilicura','CCU Qulicura','CCU Qulicura','Pluma','Traslado interno 1 contenedor 20 pies',50000,5,0,70000,'NA',null,null,null,'195','2026-09-11','2026-10-11','2026-09-26','Externo',0,0,0,0,291000,55290,null,null,null,null,0,0,0,0),
  ('2026-09-11','Flesan','SE Providencia','Lampa','Providencia','Pluma','Traslado contenedor y movimientos obra',50000,8,null,null,null,'180',null,null,'204','2026-09-25','2026-10-25',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,118819,10,0),
  ('2026-09-14','ATS','Finning','San Antonio','Enea','Camión 10 ton','Traslado de equipo',null,null,350000,null,'826520',null,null,null,'206','2026-10-05','2026-11-04',null,'Rodrigo Nuñez',0,0,10000,0,0,0,null,null,null,null,0,145987,8,0),
  ('2026-09-15','Subcargo','Novatec','San Bernardo','Padre Hurtado','Pluma','Traslado de materiales ida y vuelta',50000,5,40000,null,null,null,null,null,'197','2026-09-20','2026-10-20',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,88174,9,0),
  ('2026-09-16','Flesan','SE Providencia','Lampa','Providencia','Pluma','Traslado contenedor y movimientos obra',50000,8,null,null,null,'180',null,null,'204','2026-09-25','2026-10-25',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,159963,9.5,0),
  ('2026-09-21','ATS','Diperk','Quilicura','Conmetal','Camión 10 ton','Traslado de equipos',null,null,144000,null,'1947423 - 1947424 - 1947426 - 1947429',null,null,null,'207','2026-10-05','2026-11-04',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,77666,0,0),
  ('2026-09-22','Subcargo','Maqsa','Concon','Renca','Pluma','Traslado de contenedor',50000,8,null,null,null,null,null,null,'205','2026-10-05','2026-11-04',null,'Rodrigo Nuñez',0,0,10000,0,0,0,null,null,null,null,0,205339,9,0),
  ('2026-09-23','Inversiones Casacuberta','CCU Quilicura','Lampa','CCU Qulicura','Pluma','Traslado de contenedor',50000,5,null,70000,null,null,null,null,'203','2026-09-24','2026-10-24','2026-09-26','Rodrigo Nuñez',0,0,0,0,50000,9500,null,null,null,null,0,89133,5,0),
  ('2026-09-24','ATS','Lombac','Lampa','Noviciado Lampa','Pluma','Traslado de materiales',50000,5,null,null,'10961',null,null,null,'208','2026-10-05','2026-11-04',null,'Rodrigo Nuñez',0,0,0,10000,0,0,null,null,null,null,0,88911,6,0),
  ('2026-09-25','ATS','Finning','Conmetal','Enea','Pluma','Traslado equipos',50000,5,null,null,'16586590',null,null,null,'209','2026-10-05','2026-11-04',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,100528,5,0),
  ('2026-09-25','Flesan','SE Providencia','Providencia','Providencia','Pluma','Movimientos de obra',50000,5,null,null,null,'215',null,null,'212','2026-10-13','2026-11-12',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,'373',null,null,0,0,5,0),
  ('2026-09-28','ATS','Lombac','Lampa','Colina','Pluma','Movimiento materiales',50000,5,null,null,'814042',null,null,null,'208','2026-10-05','2026-11-04',null,'Rodrigo Nuñez',0,0,0,10000,0,0,null,null,null,null,0,149662,5,0),
  ('2026-09-28','Flesan','SE Providencia','Lampa','Providencia','Pluma','Movimiento materiales',50000,6,null,null,'27255','215',null,null,'212','2026-10-13','2026-11-12',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,'375',null,null,0,0,7,0),
  ('2026-09-29','Subcargo','Flesan','La Dehesa','Vitacura','Pluma','Movimiento materiales',32000,10,null,null,null,null,null,null,'205','2026-10-05','2026-11-04',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,132807,12,0),
  ('2026-09-30','Subcargo','Ingevec','Santiago','Santiago','Pluma','Movimiento materiales',50000,5,null,null,null,null,null,null,'205','2026-10-05','2026-11-04',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,96134,5,0),
  ('2026-10-01','Flesan','SE Providencia','Providencia','Providencia','Pluma','Movimientos de obra',50000,8,null,null,null,'180',null,null,'215','2026-10-16','2026-11-15',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,'378',null,null,0,114919,8,0),
  ('2026-10-05','Subcargo','Flesan','La Florida','Las Condes','Pluma','Movimientos de obra',50000,5,null,null,null,null,null,null,'217','2026-10-19','2026-11-18',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,154803,10,0),
  ('2026-10-06','Subcargo','Flesan','Las Condes','Las Condes','Pluma','Movimientos de obra',50000,5,null,null,null,null,null,null,'217','2026-10-19','2026-11-18',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,114074,10,0),
  ('2026-10-08','Flesan','SE Providencia','Providencia','Providencia','Pluma','Movimientos de obra',50000,5,null,null,null,'195',null,null,'220','2026-10-29','2026-11-28',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,'382',null,null,0,0,10,0),
  ('2026-10-09','Flesan','SE Providencia','Providencia','Providencia','Pluma','Movimientos de obra',50000,8,null,null,null,'180',null,null,'215','2026-10-16','2026-11-15',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,'383',null,null,0,0,10,0),
  ('2026-10-13','Flesan','SE Providencia','Providencia','Providencia','Pluma','Movimientos de obra',50000,8,null,null,null,'195',null,null,'220','2026-10-29','2026-11-28',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,'384',null,null,0,259191,10,0),
  ('2026-10-14','Flesan','SE Providencia','Providencia','Providencia','Pluma','Movimientos de obra',50000,8,null,null,null,'195',null,null,'220','2026-10-29','2026-11-28',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,'385',null,null,0,74087,10,0),
  ('2026-10-16','Flesan','SE Providencia','Providencia','Providencia','Pluma','Movimientos de obra',50000,8,null,null,null,'195',null,null,'220','2026-10-29','2026-11-28',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,'387',null,null,0,142601,4,0),
  ('2026-10-16','ATS','Finning','Enea','Conmetal','Pluma','Traslado de equipos',50000,10,null,null,'16631262, 16631257',null,null,null,'219','2026-10-23','2026-11-22',null,'Rodrigo Nuñez',0,0,0,20000,0,0,null,null,null,null,0,0,5,0),
  ('2026-10-19','Subcargo','Flesan','Lampa','Providencia','Pluma','Movimientos de obra',40000,8,null,80000,null,null,null,null,null,null,'1900-01-29',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,173637,12,0),
  ('2026-10-21','Flesan','SE Providencia','Providencia','Providencia','Pluma','Movimientos de obra',50000,8,null,null,null,'225',null,null,null,null,'1900-01-29',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,163554,10,0),
  ('2026-10-22','Flesan','SE Providencia','Providencia','Providencia','Pluma','Movimientos de obra',50000,8,null,null,null,'225',null,null,null,null,'1900-01-29',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,0,9.5,0),
  ('2026-10-26','ATS','Finning','Enea','Concón','Pluma','Traslado de equipos',50000,8,150000,null,null,null,null,null,null,null,'1900-01-29',null,'Rodrigo Nuñez',0,0,10000,20000,0,0,null,null,null,null,0,0,10,0),
  ('2026-10-28','Subcargo','Maqsa','La Florida','ATS Talagante','Pluma','Traslado de equipos',41250,8,null,null,null,null,null,null,null,null,'1900-01-29',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,0,8,0),
  ('2026-10-29','Subcargo','Maqsa','ATS Talagante','Quilicura','Pluma','Entrega contenedor',50000,4,10000,null,null,null,null,null,null,null,'1900-01-29',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,0,3,0),
  ('2026-10-30','Subcargo','Flesan','Maipú','Maipú','Pluma','Movimientos obra',40000,8,null,null,null,null,null,null,null,null,'1900-01-29',null,'Rodrigo Nuñez',0,0,0,0,0,0,null,null,null,null,0,0,9.5,0);

insert into public.ventas_servicios (
  fecha_servicio, cliente_id, proyecto_obra, origen, destino, servicio_tipo, comentario,
  valor_pluma_hora, cantidad_horas, valor_flete, extras, n_guia, n_oc, descripcion_carga,
  n_cotizacion, n_factura, fecha_facturacion, fecha_estimada_pago, fecha_pago, operador_id,
  variable_operador, salida_caja, viaticos_extras, comision_venta, pago_terceros,
  pago_iva_terceros, n_factura_tercero, n_reporte, km_inicio, km_fin, km_servicio,
  costos_petroleo_tct, h_operacion, tag_peajes)
select i.fecha_servicio, c.id, i.proyecto_obra, i.origen, i.destino, i.servicio_tipo,
  i.comentario, i.valor_pluma_hora, i.cantidad_horas, i.valor_flete, i.extras, i.n_guia,
  i.n_oc, i.descripcion_carga, i.n_cotizacion, i.n_factura, i.fecha_facturacion,
  i.fecha_estimada_pago, i.fecha_pago, o.id, i.variable_operador, i.salida_caja,
  i.viaticos_extras, i.comision_venta, i.pago_terceros, i.pago_iva_terceros,
  i.n_factura_tercero, i.n_reporte, i.km_inicio, i.km_fin, i.km_servicio,
  i.costos_petroleo_tct, i.h_operacion, i.tag_peajes
from _v_imp i
join public.clientes c on c.nombre = i.cliente
left join public.operadores o on o.nombre = i.operador
where not exists (
  select 1 from public.ventas_servicios v
  where v.fecha_servicio = i.fecha_servicio
    and v.cliente_id = c.id
    and coalesce(v.n_guia,'') = coalesce(i.n_guia,'')
    and coalesce(v.valor_pluma_hora,0) = coalesce(i.valor_pluma_hora,0)
    and coalesce(v.cantidad_horas,0) = coalesce(i.cantidad_horas,0)
    and coalesce(v.valor_flete,0) = coalesce(i.valor_flete,0)
    and coalesce(v.extras,0) = coalesce(i.extras,0)
);

commit;
