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

export const FACTURACION_ATS = [
  "facturado",
  "no_facturado",
  "ats_cargo",
  "por_definir",
] as const;

export const ESTADO_PAGO = ["cerrado", "por_pagar", "comprometido"] as const;

const fechaOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

const comun = {
  fecha: z.string().min(1, "La fecha es obligatoria"),
  categoria_costo_id: z.string().uuid("Selecciona una categoría"),
  descripcion: optionalText,
  monto_neto: money,
  iva: ivaOpcional,
  medio_pago: optionalText,
  facturacion_ats: z.enum(FACTURACION_ATS).default("por_definir"),
  estado_pago: z.enum(ESTADO_PAGO).default("cerrado"),
  fecha_estimada_pago: fechaOpcional,
  fecha_pago: fechaOpcional,
  tipo_costo: optionalText,
};

// Un compromiso sin fecha estimada no aparece en el calendario de pagos y se
// pierde de vista. La base lo exige igual; acá se avisa antes de llegar allá.
function exigirFechaSiQuedaPendiente(
  datos: { estado_pago: string; fecha_estimada_pago?: string },
  ctx: z.RefinementCtx,
) {
  if (datos.estado_pago !== "cerrado" && !datos.fecha_estimada_pago) {
    ctx.addIssue({
      code: "custom",
      path: ["fecha_estimada_pago"],
      message: "Un gasto por pagar necesita fecha estimada de pago",
    });
  }
}

export const gastoOperacionalSchema = z
  .object({
    ...comun,
    proveedor: optionalText,
    proyecto_servicio: optionalText,
    n_factura: optionalText,
  })
  .superRefine(exigirFechaSiQuedaPendiente);

export const gastoAdministrativoSchema = z
  .object({
    ...comun,
    observaciones: optionalText,
  })
  .superRefine(exigirFechaSiQuedaPendiente);

export type GastoOperacionalInput = z.infer<typeof gastoOperacionalSchema>;
export type GastoAdministrativoInput = z.infer<typeof gastoAdministrativoSchema>;
