import { z } from "zod";

const money = z.coerce.number().min(0, "No puede ser negativo").default(0);
const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

// El IVA se deja vacío en la mayoría de las cargas: la acción lo calcula como
// 19% del neto. Si la factura trae otro IVA (exenta, parcial), se digita.
const ivaOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
    message: "IVA inválido",
  });

const comun = {
  fecha: z.string().min(1, "La fecha es obligatoria"),
  categoria_costo_id: z.string().uuid("Selecciona una categoría"),
  descripcion: optionalText,
  monto_neto: money,
  iva: ivaOpcional,
  medio_pago: optionalText,
  facturado_ats: optionalText,
  tipo_costo: optionalText,
};

export const gastoOperacionalSchema = z.object({
  ...comun,
  proveedor: optionalText,
  proyecto_servicio: optionalText,
  n_factura: optionalText,
});

export const gastoAdministrativoSchema = z.object({
  ...comun,
  observaciones: optionalText,
});

export type GastoOperacionalInput = z.infer<typeof gastoOperacionalSchema>;
export type GastoAdministrativoInput = z.infer<typeof gastoAdministrativoSchema>;
