"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const manualPeajeSchema = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria"),
  concesionaria: z.string().trim().max(120).optional(),
  patente: z.string().trim().max(20).optional(),
  descripcion: z.string().trim().max(300).optional(),
  monto: z.coerce.number().min(1, "El monto debe ser mayor a 0"),
});

export async function createPeajeManual(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = manualPeajeSchema.safeParse({
    fecha: formData.get("fecha"),
    concesionaria: formData.get("concesionaria"),
    patente: formData.get("patente"),
    descripcion: formData.get("descripcion"),
    monto: formData.get("monto"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("peajes_tag")
    .insert({ ...parsed.data, created_by: user?.id });
  if (error) return { error: error.message };

  revalidatePath("/peajes");
  return { success: true };
}

async function recomputeTag(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ventaId: string | null,
) {
  if (!ventaId) return;
  const { data } = await supabase
    .from("peajes_tag")
    .select("monto")
    .eq("venta_servicio_id", ventaId);
  const total = (data ?? []).reduce((s, r) => s + Number(r.monto), 0);
  await supabase
    .from("ventas_servicios")
    .update({ tag_peajes: total })
    .eq("id", ventaId);
}

export async function assignPeaje(
  peajeId: string,
  ventaId: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: peaje } = await supabase
    .from("peajes_tag")
    .select("venta_servicio_id")
    .eq("id", peajeId)
    .single();

  const oldVenta = peaje?.venta_servicio_id ?? null;
  const newVenta = ventaId || null;

  const { error } = await supabase
    .from("peajes_tag")
    .update({ venta_servicio_id: newVenta })
    .eq("id", peajeId);
  if (error) return { error: error.message };

  await recomputeTag(supabase, oldVenta);
  if (newVenta !== oldVenta) await recomputeTag(supabase, newVenta);

  revalidatePath("/peajes");
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  return {};
}
