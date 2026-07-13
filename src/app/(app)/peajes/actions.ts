"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const peajeRowSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().nullable().optional(),
  concesionaria: z.string().min(1),
  patente: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  monto: z.number().positive(),
  documento: z.string().min(1),
});

export type ImportPeajesResult = {
  error?: string;
  inserted?: number;
  received?: number;
  autoAsignados?: number;
};

export async function importPeajes(
  rows: unknown,
): Promise<ImportPeajesResult> {
  const parsed = z.array(peajeRowSchema).safeParse(rows);
  if (!parsed.success) {
    return { error: "Los datos no tienen el formato esperado." };
  }
  if (parsed.data.length === 0) {
    return { error: "No hay movimientos para importar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = parsed.data.map((r) => ({ ...r, created_by: user?.id }));

  const { data, error } = await supabase
    .from("peajes_tag")
    .upsert(payload, { onConflict: "concesionaria,documento", ignoreDuplicates: true })
    .select("id");

  if (error) return { error: error.message };

  // Intenta asignar automáticamente lo recién importado (y cualquier otro
  // movimiento pendiente) a servicios cuya fecha coincida exactamente.
  const autoAssign = await autoAssignPeajesByFecha();

  revalidatePath("/peajes");
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
 * Asigna automáticamente los movimientos de peajes/TAG sin asignar a un
 * servicio cuando hay EXACTAMENTE un servicio con esa misma fecha de
 * ejecución. Si hay 0 o más de 1 servicio ese día, lo deja para asignación
 * manual (evita adivinar mal cuando hay ambigüedad).
 */
export async function autoAssignPeajesByFecha(): Promise<
  AutoAssignResult | { error: string }
> {
  const supabase = await createClient();

  const { data: pendientes, error: pendError } = await supabase
    .from("peajes_tag")
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
    .in("fecha_servicio", fechas);
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
      .from("peajes_tag")
      .update({ venta_servicio_id: ventaId })
      .in("id", idsDelDia);
    if (updError) return { error: updError.message };

    resultado.fechasAsignadas++;
    resultado.movimientosAsignados += idsDelDia.length;
    ventasAfectadas.add(ventaId);
  }

  for (const ventaId of ventasAfectadas) {
    await recomputeTag(supabase, ventaId);
  }

  revalidatePath("/peajes");
  revalidatePath("/ventas");
  revalidatePath("/dashboard");

  return resultado;
}

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
