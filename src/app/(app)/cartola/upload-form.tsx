"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseCartola, type Cuadratura, type MovimientoCartola } from "./parsers";
import { importarCartola } from "./actions";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

type Preview = {
  archivo: string;
  movimientos: MovimientoCartola[];
  omitidas: number;
  cargos: number;
  abonos: number;
  cuadratura: Cuadratura | null;
};

export function CartolaUploadForm() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLeyendo(true);
    setError(null);
    setResultado(null);
    setPreview(null);

    const res = await parseCartola(file);
    setLeyendo(false);
    e.target.value = "";

    if ("error" in res) {
      setError(res.error);
      return;
    }
    setPreview({ archivo: file.name, ...res });
  }

  async function handleConfirmar() {
    if (!preview) return;
    setImportando(true);
    const res = await importarCartola(preview.movimientos, preview.archivo);
    setImportando(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    const repetidos = (res.recibidos ?? 0) - (res.insertados ?? 0);
    setResultado(
      `${res.insertados} movimiento(s) nuevo(s)` +
        (repetidos > 0 ? ` · ${repetidos} ya estaba(n) cargado(s)` : ""),
    );
    setPreview(null);
    router.refresh();
  }

  const q = preview?.cuadratura;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-700">Importar cartola</h2>
      <p className="mt-1 text-sm text-gray-500">
        Descarga la cartola desde Santander en Excel y súbela acá. Los períodos
        que se traslapen no se duplican.
      </p>

      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFile}
        disabled={leyendo || importando}
        className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black file:px-3 file:py-2 file:text-white"
      />

      {leyendo && <p className="mt-3 text-sm text-gray-500">Leyendo el archivo...</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {resultado && <p className="mt-3 text-sm text-green-700">{resultado}</p>}

      {preview && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="text-sm text-gray-700">
            <span className="font-medium">{preview.movimientos.length}</span> movimientos
            {" · "}
            {preview.cargos} cargos, {preview.abonos} abonos
            {preview.omitidas > 0 && (
              <span className="text-gray-500"> · {preview.omitidas} fila(s) sin datos</span>
            )}
          </div>

          {q ? (
            <div
              className={`rounded-md border p-3 text-sm ${
                q.cuadra
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <p className="font-medium">
                {q.cuadra
                  ? "Cuadra con los totales de la cartola"
                  : "No cuadra con los totales de la cartola"}
              </p>
              <p className="mt-1">
                Cargos: {money.format(q.cargosLeidos)} leídos vs{" "}
                {money.format(q.cargosBanco)} del banco · Abonos:{" "}
                {money.format(q.abonosLeidos)} vs {money.format(q.abonosBanco)}
              </p>
              {!q.cuadra && (
                <p className="mt-1">
                  Revisa el archivo antes de importar: puede faltar parte del detalle.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              El archivo no trae cuadro de saldos, así que no puedo verificar la
              cuadratura automáticamente.
            </p>
          )}

          <div className="max-h-64 overflow-auto rounded-md border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Glosa</th>
                  <th className="px-3 py-2">RUT</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {preview.movimientos.map((m, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-3 py-1.5">{m.fecha}</td>
                    <td className="px-3 py-1.5">{m.glosa}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-gray-500">
                      {m.rut ?? "—"}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-1.5 text-right ${
                        m.tipo === "cargo" ? "text-red-700" : "text-green-700"
                      }`}
                    >
                      {m.tipo === "cargo" ? "−" : "+"}
                      {money.format(m.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={importando}
              className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {importando ? "Importando..." : "Importar"}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
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
