import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Planilla de gastos que NO están facturados a nombre de ATS Proyectos.
 *
 * Es lo que va a los contadores para el balance: lo que se gastó de verdad
 * pero no entró por una factura a nombre de la empresa, y por lo tanto no
 * aparece en el libro de compras ni da crédito fiscal.
 *
 * Se entrega como CSV con separador ";" y BOM UTF-8 para que Excel en español
 * lo abra en columnas y respete las tildes sin pedir nada.
 */

const ETIQUETA: Record<string, string> = {
  no_facturado: "Sin factura a la empresa",
  ats_cargo: "Facturado a ATS Cargo",
  por_definir: "Por definir",
};

type Fila = {
  mes: string;
  facturacion_ats: string;
  origen: string;
  categoria: string;
  subcategoria: string;
  documentos: number;
  neto: number;
  iva: number;
  total: number;
};

function celda(valor: unknown): string {
  const s = String(valor ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_gastos_no_facturados")
    .select("mes, facturacion_ats, origen, categoria, subcategoria, documentos, neto, iva, total")
    .order("mes", { ascending: true });

  if (error) {
    return new Response(`No se pudo generar la planilla: ${error.message}`, {
      status: 500,
    });
  }

  const filas = (data ?? []) as Fila[];
  const encabezado = [
    "Mes",
    "Situación",
    "Origen",
    "Categoría",
    "Subcategoría",
    "Documentos",
    "Neto",
    "IVA",
    "Total",
  ];

  const lineas = [encabezado.join(";")];
  for (const f of filas) {
    lineas.push(
      [
        f.mes,
        ETIQUETA[f.facturacion_ats] ?? f.facturacion_ats,
        f.origen,
        f.categoria,
        f.subcategoria,
        f.documentos,
        Math.round(Number(f.neto)),
        Math.round(Number(f.iva)),
        Math.round(Number(f.total)),
      ]
        .map(celda)
        .join(";"),
    );
  }

  const totalGeneral = filas.reduce((a, f) => a + Number(f.total), 0);
  lineas.push("");
  lineas.push(["TOTAL", "", "", "", "", "", "", "", Math.round(totalGeneral)].join(";"));

  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${lineas.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gastos-no-facturados-ATS-${hoy}.csv"`,
    },
  });
}
