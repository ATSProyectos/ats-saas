"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  gastoAdministrativoSchema,
  gastoOperacionalSchema,
} from "@/lib/validations/gasto";

export type GastoActionResult = { error?: string; success?: boolean };

// 19% del neto cuando la carga no trae un IVA distinto (factura exenta,
// parcial o con retención se digita a mano).
function ivaPorDefecto(montoNeto: number, iva: number | undefined): number {
  return iva ?? Math.round(montoNeto * 0.19);
}

function revalidarReportes() {
  revalidatePath("/gastos");
  revalidatePath("/eerr");
}

export async function saveGastoOperacional(
  _prev: GastoActionResult,
  formData: FormData,
): Promise<GastoActionResult> {
  const parsed = gastoOperacionalSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { iva, ...values } = parsed.data;
  const { error } = await supabase.from("gastos_operacionales").insert({
    ...values,
    iva: ivaPorDefecto(values.monto_neto, iva),
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidarReportes();
  return { success: true };
}

export async function saveGastoAdministrativo(
  _prev: GastoActionResult,
  formData: FormData,
): Promise<GastoActionResult> {
  const parsed = gastoAdministrativoSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { iva, ...values } = parsed.data;
  const { error } = await supabase.from("gastos_administrativos").insert({
    ...values,
    iva: ivaPorDefecto(values.monto_neto, iva),
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidarReportes();
  return { success: true };
}

export async function deleteGastoOperacional(
  id: string,
): Promise<GastoActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gastos_operacionales")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };

  revalidarReportes();
  return { success: true };
}

export async function deleteGastoAdministrativo(
  id: string,
): Promise<GastoActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gastos_administrativos")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };

  revalidarReportes();
  return { success: true };
}
