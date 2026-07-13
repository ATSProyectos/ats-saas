"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importConsumos, type ImportResult } from "./actions";

// Convierte un número en formato chileno ("89.537", "66,77") a Number.
function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const clean = s.trim().replace(/\./g, "").replace(",", ".");
  if (clean === "") return null;
  const n = Number(clean);
  return Number.isNaN(n) ? null : n;
}

// "02-07-2026" (DD-MM-YYYY) -> "2026-07-02"
function parseFecha(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Divide una línea CSV respetando comillas (los números traen comas dentro).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function findIndex(headers: string[], needle: string): number {
  const n = needle.toLowerCase();
  return headers.findIndex((h) => h.toLowerCase().includes(n));
}

type ParsedRow = {
  fecha: string;
  hora: string | null;
  patente: string | null;
  estacion: string | null;
  comuna: string | null;
  guia_despacho: string;
  precio_litro: number | null;
  volumen_litros: number | null;
  monto: number;
  odometro_km: number | null;
  rendimiento_km_litro: number | null;
};

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  const idx = {
    patente: findIndex(headers, "patente"),
    comuna: findIndex(headers, "comuna"),
    estacion: findIndex(headers, "estaci"),
    fecha: findIndex(headers, "fecha"),
    hora: findIndex(headers, "hora"),
    guia: findIndex(headers, "gu"),
    precio: findIndex(headers, "precio"),
    volumen: findIndex(headers, "volumen"),
    monto: findIndex(headers, "monto"),
    odometro: findIndex(headers, "od"),
    rendKm: headers.findIndex((h) => h.toLowerCase().includes("kms. por litro")),
  };

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const fecha = parseFecha(cols[idx.fecha]);
    const guia = cols[idx.guia]?.trim();
    const monto = parseNum(cols[idx.monto]);
    if (!fecha || !guia || monto === null) continue; // fila incompleta

    rows.push({
      fecha,
      hora: cols[idx.hora]?.trim() || null,
      patente: cols[idx.patente]?.trim() || null,
      estacion: cols[idx.estacion]?.trim() || null,
      comuna: cols[idx.comuna]?.trim() || null,
      guia_despacho: guia,
      precio_litro: parseNum(cols[idx.precio]),
      volumen_litros: parseNum(cols[idx.volumen]),
      monto,
      odometro_km: parseNum(cols[idx.odometro]),
      rendimiento_km_litro: idx.rendKm >= 0 ? parseNum(cols[idx.rendKm]) : null,
    });
  }
  return rows;
}

export function UploadForm() {
  const router = useRouter();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setResult({ error: "No se encontraron consumos en el archivo." });
        setLoading(false);
        return;
      }
      const res = await importConsumos(rows);
      setResult(res);
      if (!res.error) router.refresh();
    } catch {
      setResult({ error: "No se pudo leer el archivo." });
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-700">
        Importar consumos de Copec (CSV)
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Descarga el detalle de consumos por patente desde Copec TCT y súbelo
        aquí. Los consumos ya importados no se duplican.
      </p>
      <label className="mt-3 inline-flex cursor-pointer items-center rounded-md bg-black px-4 py-2 text-sm text-white">
        {loading ? "Procesando..." : "Seleccionar archivo CSV"}
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          disabled={loading}
          className="hidden"
        />
      </label>
      {result?.error && (
        <p className="mt-2 text-sm text-red-600">{result.error}</p>
      )}
      {result && !result.error && (
        <p className="mt-2 text-sm text-emerald-700">
          {result.inserted} consumo(s) importado(s) de {result.received} leído(s)
          {result.received !== result.inserted &&
            " (el resto ya existía)"}
          {result.autoAsignados ? ` · ${result.autoAsignados} asignado(s) automáticamente al servicio pluma del día` : ""}
          .
        </p>
      )}
    </div>
  );
}
