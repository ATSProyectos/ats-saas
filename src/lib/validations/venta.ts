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
  monto_neto: money,
  iva: money,
  variable_operador: money,
  salida_caja: money,
  viaticos_extras: money,
  comision_venta: money,
  pago_terceros: money,
  pago_iva_terceros: money,
  costos_petroleo: money,
  tag_peajes: money,
  n_cotizacion: optionalText,
  n_factura: optionalText,
  fecha_facturacion: optionalText,
  fecha_pago: optionalText,
});

export type VentaInput = z.infer<typeof ventaSchema>;
