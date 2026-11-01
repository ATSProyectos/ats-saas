"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MovimientoCartola } from "./parsers";

export type ResultadoAccion = { error?: string; success?: boolean };

function revalidar() {
  revalidatePath("/cartola");
  revalidatePath("/gastos");
  revalidatePath("/eerr");
}

/**
 * La cartola entrega el TOTAL pagado; los gastos se guardan en neto + IVA.
 * Se desagrega hacia atrás para que neto + iva dé exactamente el total y el
 * EERR (que trabaja en netos) no quede descuadrado contra el banco.
 */
function desglosarIva(total: number, conIva: boolean): { neto: number; iva: number } {
  if (!conIva) return { neto: total, iva: 0 };
  const neto = Math.round(total / 1.19);
  return { neto, iva: total - neto };
}

export async function importarCartola(
  movimientos: MovimientoCartola[],
  archivo: string,
): Promise<ResultadoAccion & { insertados?: number; recibidos?: number }> {
  if (movimientos.length === 0) return { error: "No hay movimientos que importar." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // La clave única (fecha, glosa, monto, tipo) absorbe el traslape entre
  // descargas: lo ya cargado se ignora en vez de duplicarse.
  const { data, error } = await supabase
    .from("cartola_movimientos")
    .upsert(
      movimientos.map((m) => ({
        fecha: m.fecha,
        glosa: m.glosa,
        monto: m.monto,
        tipo: m.tipo,
        saldo: m.saldo,
        rut: m.rut,
        archivo,
        created_by: user?.id,
      })),
      { onConflict: "fecha,glosa,monto,tipo", ignoreDuplicates: true },
    )
    .select("id");

  if (error) return { error: error.message };

  revalidar();
  return { success: true, insertados: data?.length ?? 0, recibidos: movimientos.length };
}

type RegistrarInput = {
  movimientoId: string;
  destino: "operacional" | "administrativo";
  categoriaCostoId: string;
  proveedor: string | null;
  conIva: boolean;
  descripcion: string;
  // Cuando viene, la clasificación queda aprendida para la próxima cartola.
  patronRegla: string | null;
  etiquetaRegla: string | null;
};

export async function registrarComoGasto(input: RegistrarInput): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: mov, error: errorMov } = await supabase
    .from("cartola_movimientos")
    .select("id, fecha, glosa, monto, tipo, estado")
    .eq("id", input.movimientoId)
    .single();

  if (errorMov || !mov) return { error: "No encontré el movimiento." };
  if (mov.estado !== "pendiente") return { error: "Ese movimiento ya fue resuelto." };
  if (mov.tipo !== "cargo")
    return { error: "Solo los cargos se registran como gasto; un abono es un ingreso." };

  const { neto, iva } = desglosarIva(Number(mov.monto), input.conIva);
  const comun = {
    fecha: mov.fecha,
    categoria_costo_id: input.categoriaCostoId,
    monto_neto: neto,
    iva,
    medio_pago: "Cartola Santander",
    // Un cargo en la cartola ya salió de la cuenta: el gasto nace pagado.
    // Si tiene factura a nombre de ATS no se sabe desde el banco, así que
    // queda por definir en vez de asumirse.
    estado_pago: "cerrado" as const,
    fecha_pago: mov.fecha,
    created_by: user?.id,
  };

  // Dos ramas separadas en vez de un objeto unión: las tablas no comparten
  // columnas (proveedor vs observaciones) y el tipado del cliente las valida
  // contra el esquema de cada una.
  const { data: gasto, error: errorGasto } =
    input.destino === "operacional"
      ? await supabase
          .from("gastos_operacionales")
          .insert({
            ...comun,
            proveedor: input.proveedor,
            descripcion: input.descripcion,
          })
          .select("id")
          .single()
      : await supabase
          .from("gastos_administrativos")
          .insert({
            ...comun,
            descripcion: input.descripcion,
            observaciones: mov.glosa,
          })
          .select("id")
          .single();

  if (errorGasto || !gasto) return { error: errorGasto?.message ?? "No se pudo crear el gasto." };

  const { error: errorCierre } = await supabase
    .from("cartola_movimientos")
    .update({
      estado: "registrado",
      ...(input.destino === "operacional"
        ? { gasto_operacional_id: gasto.id }
        : { gasto_administrativo_id: gasto.id }),
    })
    .eq("id", mov.id);

  if (errorCierre) return { error: errorCierre.message };

  if (input.patronRegla && input.etiquetaRegla) {
    // Si la regla ya existe se deja la que estaba: la primera clasificación
    // manda, y corregirla es una edición explícita, no un efecto secundario.
    await supabase.from("reglas_clasificacion").upsert(
      {
        patron: input.patronRegla,
        etiqueta: input.etiquetaRegla,
        proveedor: input.proveedor,
        destino: input.destino,
        categoria_costo_id: input.categoriaCostoId,
        con_iva: input.conIva,
        created_by: user?.id,
      },
      { onConflict: "patron", ignoreDuplicates: true },
    );
  }

  revalidar();
  return { success: true };
}

export async function descartarMovimiento(
  id: string,
  motivo: string | null,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cartola_movimientos")
    .update({ estado: "descartado", archivo: motivo ?? undefined })
    .eq("id", id)
    .eq("estado", "pendiente");

  if (error) return { error: error.message };
  revalidar();
  return { success: true };
}

export async function reabrirMovimiento(id: string): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cartola_movimientos")
    .update({ estado: "pendiente" })
    .eq("id", id)
    .eq("estado", "descartado");

  if (error) return { error: error.message };
  revalidar();
  return { success: true };
}
