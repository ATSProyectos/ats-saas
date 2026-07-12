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

  const payload = parsed.data.map((r) => ({ ...r, created_by: user?.id }));

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
    .select("monto")
    .eq("venta_servicio_id", ventaId);
  const total = (data ?? []).reduce((s, r) => s + Number(r.monto), 0);
  await supabase
    .from("ventas_servicios")
    .update({ costos_petroleo: total })
    .eq("id", ventaId);
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
