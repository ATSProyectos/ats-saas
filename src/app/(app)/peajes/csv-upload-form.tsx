"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parsePeajesFile, type NormalizedPeaje } from "./parsers";
import { importPeajes } from "./actions";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

type Preview = {
  concesionaria: string;
  rows: NormalizedPeaje[];
  omitidas: number;
};

export function PeajeCsvUploadForm() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPreview(null);

    const res = await parsePeajesFile(file);
    setLoading(false);
    e.target.value = "";

    if ("error" in res) {
      setError(res.error);
      return;
    }
    setPreview({
      concesionaria: res.concesionariaSugerida,
      rows: res.rows,
      omitidas: res.omitidas,
    });
  }

  async function handleConfirm() {
    if (!preview) return;
    setImporting(true);
    const rows = preview.rows.map((r) => ({
      ...r,
      concesionaria: preview.concesionaria,
    }));
    const res = await importPeajes(rows);
    setImporting(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    setResult(
      `${res.inserted} movimiento(s) importado(s) de ${res.received} leído(s)` +
        (res.received !== res.inserted ? " (el resto ya existía y se omitió)." : "."),
    );
    setPreview(null);
    router.refresh();
  }

  const totalMonto = preview?.rows.reduce((s, r) => s + r.monto, 0) ?? 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-700">
        Importar CSV/Excel de una concesionaria
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Soporta Costanera Norte, Autopista Central, Vespucio Oriente (AVO),
        Vespucio Norte (AVN), Autopista del Maipo y Autopista del Sol. El
        sistema detecta el formato automáticamente.
      </p>

      {!preview && (
        <label className="mt-3 inline-flex cursor-pointer items-center rounded-md bg-black px-4 py-2 text-sm text-white">
          {loading ? "Leyendo archivo..." : "Seleccionar archivo (.csv, .xls, .xlsx)"}
          <input
            type="file"
            accept=".csv,.xls,.xlsx,text/csv"
            onChange={handleFile}
            disabled={loading}
            className="hidden"
          />
        </label>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {result && <p className="mt-2 text-sm text-emerald-700">{result}</p>}

      {preview && (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="conces_nombre" className="mb-1 block text-xs font-medium text-gray-600">
                Concesionaria detectada (puedes corregirla)
              </label>
              <input
                id="conces_nombre"
                value={preview.concesionaria}
                onChange={(e) =>
                  setPreview({ ...preview, concesionaria: e.target.value })
                }
                className="w-64 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <span className="text-sm text-gray-600">
              {preview.rows.length} movimientos · {money.format(totalMonto)}
              {preview.omitidas > 0 && ` · ${preview.omitidas} fila(s) omitida(s)`}
            </span>
          </div>

          <div className="mt-3 max-h-48 overflow-y-auto rounded border border-gray-200 bg-white">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-100 text-left text-gray-500">
                <tr>
                  <th className="px-2 py-1">Fecha</th>
                  <th className="px-2 py-1">Patente</th>
                  <th className="px-2 py-1">Descripción</th>
                  <th className="px-2 py-1 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1">{r.fecha}</td>
                    <td className="px-2 py-1">{r.patente ?? "—"}</td>
                    <td className="px-2 py-1">{r.descripcion ?? "—"}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {money.format(r.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 20 && (
              <p className="px-2 py-1 text-[11px] text-gray-400">
                ...y {preview.rows.length - 20} más.
              </p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={importing}
              className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {importing ? "Importando..." : `Importar ${preview.rows.length} movimientos`}
            </button>
            <button
              onClick={() => setPreview(null)}
              disabled={importing}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
