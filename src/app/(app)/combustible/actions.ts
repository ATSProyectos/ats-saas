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
  autoAsignados?: number;
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

  // Intenta asignar automáticamente lo recién importado (y cualquier otro
  // consumo pendiente) al servicio pluma (HFSX24) de esa misma fecha.
  const autoAssign = await autoAssignConsumosByFecha();

  revalidatePath("/combustible");
  return {
    inserted: data?.length ?? 0,
    received: parsed.data.length,
    autoAsignados: "error" in autoAssign ? 0 : autoAssign.movimientosAsignados,
  };
}

export type AutoAssignResult = {
  fechasAsignadas: number;
  movimientosAsignados: number;
  fechasAmbiguas: number;
  fechasSinServicio: number;
};

/**
 * Asigna automáticamente los consumos de combustible sin asignar a un
 * servicio. El camión pluma HFSX24 es el único vehículo propio de ATS al
 * que aplican estos costos (el resto de servicios son con otros vehículos
 * o subcontratados con externos), así que solo se considera como candidato
 * el servicio con `servicio_tipo` = "Pluma" de esa fecha. Si esa fecha no
 * tiene ningún servicio pluma, o tiene más de uno, se deja para asignación
 * manual (evita adivinar mal cuando hay ambigüedad). Mismo criterio que
 * autoAssignPeajesByFecha en el módulo de Peajes.
 */
export async function autoAssignConsumosByFecha(): Promise<
  AutoAssignResult | { error: string }
> {
  const supabase = await createClient();

  const { data: pendientes, error: pendError } = await supabase
    .from("consumos_combustible")
    .select("id, fecha")
    .is("venta_servicio_id", null);
  if (pendError) return { error: pendError.message };

  const empty: AutoAssignResult = {
    fechasAsignadas: 0,
    movimientosAsignados: 0,
    fechasAmbiguas: 0,
    fechasSinServicio: 0,
  };
  if (!pendientes || pendientes.length === 0) return empty;

  const fechas = Array.from(new Set(pendientes.map((p) => p.fecha)));

  const { data: ventas, error: ventasError } = await supabase
    .from("ventas_servicios")
    .select("id, fecha_servicio")
    .in("fecha_servicio", fechas)
    .ilike("servicio_tipo", "%pluma%");
  if (ventasError) return { error: ventasError.message };

  const ventasPorFecha = new Map<string, string[]>();
  for (const v of ventas ?? []) {
    const list = ventasPorFecha.get(v.fecha_servicio) ?? [];
    list.push(v.id);
    ventasPorFecha.set(v.fecha_servicio, list);
  }

  const resultado = { ...empty };
  const ventasAfectadas = new Set<string>();

  for (const fecha of fechas) {
    const candidatos = ventasPorFecha.get(fecha) ?? [];
    if (candidatos.length === 0) {
      resultado.fechasSinServicio++;
      continue;
    }
    if (candidatos.length > 1) {
      resultado.fechasAmbiguas++;
      continue;
    }

    const ventaId = candidatos[0];
    const idsDelDia = pendientes.filter((p) => p.fecha === fecha).map((p) => p.id);

    const { error: updError } = await supabase
      .from("consumos_combustible")
      .update({ venta_servicio_id: ventaId })
      .in("id", idsDelDia);
    if (updError) return { error: updError.message };

    resultado.fechasAsignadas++;
    resultado.movimientosAsignados += idsDelDia.length;
    ventasAfectadas.add(ventaId);
  }

  for (const ventaId of ventasAfectadas) {
    await recomputePetroleo(supabase, ventaId);
  }

  revalidatePath("/combustible");
  revalidatePath("/ventas");
  revalidatePath("/dashboard");

  return resultado;
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
