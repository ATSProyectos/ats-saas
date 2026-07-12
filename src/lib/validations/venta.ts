import { z } from "zod";

const money = z.coerce.number().min(0, "No puede ser negativo").default(0);
const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const ventaSchema = z.object({
  fecha_servicio: z.string().min(1, "La fecha es obligatoria"),
  cliente_id: z.string().uuid("Selecciona un cliente"),
  operador_nombre: optionalText,
  proyecto_obra: optionalText,
  origen: optionalText,
  destino: optionalText,
  servicio_tipo: optionalText,
  descripcion_carga: optionalText,
  comentario: optionalText,
  // Componentes del ingreso. El monto neto, IVA y total se calculan solos
  // en la base de datos a partir de estos valores.
  valor_pluma_hora: money,
  cantidad_horas: money,
  valor_flete: money,
  rigger: money,
  extras: money,
  // Costos directos del servicio. (Petróleo TCT/sin TCT y TAG/peajes NO se
  // capturan aquí: los alimentan los módulos Combustible y Peajes.)
  variable_operador: money,
  salida_caja: money,
  viaticos_extras: money,
  comision_venta: money,
  pago_terceros: money,
  pago_iva_terceros: money,
  // Facturación.
  n_cotizacion: optionalText,
  n_factura: optionalText,
  fecha_facturacion: optionalText,
  fecha_pago: optionalText,
});

export type VentaInput = z.infer<typeof ventaSchema>;
