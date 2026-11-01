import { z } from "zod";

// Días entre facturación y pago. Vacío significa que no hay convenio ni
// histórico suficiente: la fecha estimada se digita a mano en cada venta.
const diasPago = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 365), {
    message: "El plazo debe ser un número de días entre 0 y 365",
  });

export const clienteSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(200),
  dias_pago: diasPago,
});

export type ClienteInput = z.infer<typeof clienteSchema>;
