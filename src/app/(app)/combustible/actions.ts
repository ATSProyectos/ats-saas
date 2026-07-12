"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const consumoRowSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  hora: z.string().optional().nullable(),
  patente: z.string().optional().nullable(),
  estacion: z.string().optional().nullable(),
  comuna: z.string().optional().nullable(),
  guia_despacho: z.string().min(1),
  precio_litro: z.number().nullable().optional(),
  volumen_litros: z.number().nullable().optional(),
  monto: z.number(),
  odometro_km: z.number().nullable().optional(),
  rendimiento_km_litro: z.number().nullable().optional(),
});

export type ImportResult = {
  error?: string;
  inserted?: number;
  received?: number;
};

export async function importConsumos(
  rows: unknown,
): Promise<ImportResult> {
  const parsed = z.array(consumoRowSchema).safeParse(rows);
  if (!parsed.success) {
    return { error: "El archivo no tiene el formato esperado de Copec TCT." };
  }
  if (parsed.data.length === 0) {
    return { error: "No se encontraron consumos válidos en el archivo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Todo lo que viene del CSV de Copec es modalidad TCT.
  const payload = parsed.data.map((r) => ({
    ...r,
    es_tct: true,
    created_by: user?.id,
  }));

  // onConflict en guia_despacho + ignoreDuplicates: no re-importa lo ya cargado.
  const { data, error } = await supabase
    .from("consumos_combustible")
    .upsert(payload, { onConflict: "guia_despacho", ignoreDuplicates: true })
    .select("id");

  if (error) return { error: error.message };

  revalidatePath("/combustible");
  return { inserted: data?.length ?? 0, received: parsed.data.length };
}

async function recomputePetroleo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ventaId: string | null,
) {
  if (!ventaId) return;
  const { data } = await supabase
    .from("consumos_combustible")
    .select("monto, es_tct")
    .eq("venta_servicio_id", ventaId);
  const tct = (data ?? [])
    .filter((r) => r.es_tct)
    .reduce((s, r) => s + Number(r.monto), 0);
  const sinTct = (data ?? [])
    .filter((r) => !r.es_tct)
    .reduce((s, r) => s + Number(r.monto), 0);
  await supabase
    .from("ventas_servicios")
    .update({
      costos_petroleo_tct: tct,
      costos_petroleo_sin_tct: sinTct,
    })
    .eq("id", ventaId);
}

const manualConsumoSchema = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria"),
  estacion: z.string().trim().max(200).optional(),
  patente: z.string().trim().max(20).optional(),
  volumen_litros: z.coerce.number().min(0).optional(),
  monto: z.coerce.number().min(1, "El monto debe ser mayor a 0"),
});

export async function createConsumoManual(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = manualConsumoSchema.safeParse({
    fecha: formData.get("fecha"),
    estacion: formData.get("estacion"),
    patente: formData.get("patente"),
    volumen_litros: formData.get("volumen_litros") || 0,
    monto: formData.get("monto"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("consumos_combustible").insert({
    ...parsed.data,
    es_tct: false, // carga fuera de la modalidad TCT
    created_by: user?.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/combustible");
  return { success: true };
}

export async function assignConsumo(
  consumoId: string,
  ventaId: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: consumo } = await supabase
    .from("consumos_combustible")
    .select("venta_servicio_id")
    .eq("id", consumoId)
    .single();

  const oldVenta = consumo?.venta_servicio_id ?? null;
  const newVenta = ventaId || null;

  const { error } = await supabase
    .from("consumos_combustible")
    .update({ venta_servicio_id: newVenta })
    .eq("id", consumoId);
  if (error) return { error: error.message };

  await recomputePetroleo(supabase, oldVenta);
  if (newVenta !== oldVenta) await recomputePetroleo(supabase, newVenta);

  revalidatePath("/combustible");
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  return {};
}
