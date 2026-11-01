"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DocumentoSii } from "./parsers";

export type ResultadoAccion = { error?: string; success?: boolean };

function revalidar() {
  revalidatePath("/facturas");
  revalidatePath("/cartola");
  revalidatePath("/gastos");
  revalidatePath("/eerr");
}

export async function importarDocumentos(
  documentos: DocumentoSii[],
  archivo: string,
): Promise<ResultadoAccion & { insertados?: number; recibidos?: number }> {
  if (documentos.length === 0) return { error: "No hay documentos que importar." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // La clave (rut_emisor, tipo_dte, folio) es la del propio DTE: reimportar el
  // mismo correo o el mismo envío no duplica nada.
  const { data, error } = await supabase
    .from("documentos_sii")
    .upsert(
      documentos.map((d) => ({
        rut_emisor: d.rutEmisor,
        tipo_dte: d.tipoDte,
        folio: d.folio,
        razon_social: d.razonSocial,
        fecha_emision: d.fechaEmision,
        monto_neto: d.montoNeto,
        monto_exento: d.montoExento,
        iva: d.iva,
        monto_total: d.montoTotal,
        signo: d.signo,
        detalle: d.detalle,
        archivo,
        created_by: user?.id,
      })),
      { onConflict: "rut_emisor,tipo_dte,folio", ignoreDuplicates: true },
    )
    .select("id");

  if (error) return { error: error.message };

  revalidar();
  return { success: true, insertados: data?.length ?? 0, recibidos: documentos.length };
}

type RegistrarInput = {
  documentoId: string;
  destino: "operacional" | "administrativo";
  categoriaCostoId: string;
  patronRegla: string | null;
  etiquetaRegla: string | null;
};

export async function registrarDocumento(input: RegistrarInput): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: doc, error: errorDoc } = await supabase
    .from("documentos_sii")
    .select(
      "id, rut_emisor, razon_social, tipo_dte, folio, fecha_emision, monto_neto, monto_exento, iva, signo, detalle, estado",
    )
    .eq("id", input.documentoId)
    .single();

  if (errorDoc || !doc) return { error: "No encontré el documento." };
  if (doc.estado !== "pendiente") return { error: "Ese documento ya fue resuelto." };

  // El XML ya trae neto e IVA exactos: no hay que desagregar nada. El signo
  // deja la nota de crédito como gasto negativo, que es lo que rebaja el mes.
  const signo = Number(doc.signo);

  // Plazo por defecto hasta que se confirme el real. El calendario de pagos lo
  // exige: un compromiso sin fecha no aparece y se pierde de vista.
  const vencimiento = new Date(`${doc.fecha_emision}T00:00:00Z`);
  vencimiento.setUTCDate(vencimiento.getUTCDate() + 30);

  const comun = {
    fecha: doc.fecha_emision,
    categoria_costo_id: input.categoriaCostoId,
    monto_neto: signo * (Number(doc.monto_neto) + Number(doc.monto_exento)),
    iva: signo * Number(doc.iva),
    // El XML ya probó que la factura va dirigida a ATS Proyectos: el parser
    // rechaza las que apuntan a otro receptor.
    facturacion_ats: "facturado" as const,
    // Existir la factura no significa estar pagada. Nace como cuenta por
    // pagar; el cruce con la cartola es lo que después la cierra.
    estado_pago: "por_pagar" as const,
    fecha_estimada_pago: vencimiento.toISOString().slice(0, 10),
    created_by: user?.id,
  };
  const descripcion = [doc.detalle, `Folio ${doc.folio}`].filter(Boolean).join(" · ");

  const { data: gasto, error: errorGasto } =
    input.destino === "operacional"
      ? await supabase
          .from("gastos_operacionales")
          .insert({
            ...comun,
            proveedor: doc.razon_social,
            descripcion,
            n_factura: String(doc.folio),
          })
          .select("id")
          .single()
      : await supabase
          .from("gastos_administrativos")
          .insert({
            ...comun,
            descripcion: `${doc.razon_social ?? "Documento"} · ${descripcion}`,
          })
          .select("id")
          .single();

  if (errorGasto || !gasto)
    return { error: errorGasto?.message ?? "No se pudo crear el gasto." };

  const { error: errorCierre } = await supabase
    .from("documentos_sii")
    .update({
      estado: "registrado",
      ...(input.destino === "operacional"
        ? { gasto_operacional_id: gasto.id }
        : { gasto_administrativo_id: gasto.id }),
    })
    .eq("id", doc.id);

  if (errorCierre) return { error: errorCierre.message };

  if (input.patronRegla && input.etiquetaRegla) {
    await supabase.from("reglas_clasificacion").upsert(
      {
        patron: input.patronRegla,
        etiqueta: input.etiquetaRegla,
        proveedor: doc.razon_social,
        destino: input.destino,
        categoria_costo_id: input.categoriaCostoId,
        con_iva: Number(doc.iva) > 0,
        created_by: user?.id,
      },
      { onConflict: "patron", ignoreDuplicates: true },
    );
  }

  revalidar();
  return { success: true };
}

export async function descartarDocumento(id: string): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("documentos_sii")
    .update({ estado: "descartado" })
    .eq("id", id)
    .eq("estado", "pendiente");

  if (error) return { error: error.message };
  revalidar();
  return { success: true };
}
