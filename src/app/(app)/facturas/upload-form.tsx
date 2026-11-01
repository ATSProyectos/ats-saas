"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseArchivosDte, type DocumentoSii } from "./parsers";
import { importarDocumentos } from "./actions";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function FacturasUploadForm() {
  const router = useRouter();
  const [documentos, setDocumentos] = useState<DocumentoSii[] | null>(null);
  const [nombreLote, setNombreLote] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setLeyendo(true);
    setError(null);
    setResultado(null);
    setDocumentos(null);

    const res = await parseArchivosDte(files);
    setLeyendo(false);
    e.target.value = "";

    setAvisos(res.avisos);
    if (res.documentos.length === 0) {
      setError("Ninguno de los archivos tenía un documento de compra utilizable.");
      return;
    }
    setDocumentos(res.documentos);
    setNombreLote(
      files.length === 1 ? files[0].name : `${files.length} archivos XML`,
    );
  }

  async function handleConfirmar() {
    if (!documentos) return;
    setImportando(true);
    const res = await importarDocumentos(documentos, nombreLote);
    setImportando(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    const repetidos = (res.recibidos ?? 0) - (res.insertados ?? 0);
    setResultado(
      `${res.insertados} documento(s) nuevo(s)` +
        (repetidos > 0 ? ` · ${repetidos} ya estaba(n) cargado(s)` : ""),
    );
    setDocumentos(null);
    router.refresh();
  }

  const total = (documentos ?? []).reduce((a, d) => a + d.signo * d.montoTotal, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-700">Importar XML del SII</h2>
      <p className="mt-1 text-sm text-gray-500">
        Guarda los XML que llegan al correo y súbelos acá. Puedes seleccionar
        varios de una vez. El folio evita que un documento se cargue dos veces.
      </p>

      <input
        type="file"
        accept=".xml,text/xml,application/xml"
        multiple
        onChange={handleFiles}
        disabled={leyendo || importando}
        className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black file:px-3 file:py-2 file:text-white"
      />

      {leyendo && <p className="mt-3 text-sm text-gray-500">Leyendo los XML...</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {resultado && <p className="mt-3 text-sm text-green-700">{resultado}</p>}

      {avisos.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}

      {documentos && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="text-sm text-gray-700">
            <span className="font-medium">{documentos.length}</span> documento(s) ·
            total {money.format(total)}
          </div>

          <div className="max-h-64 overflow-auto rounded-md border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Emisor</th>
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2 text-right">Neto</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((d) => (
                  <tr key={`${d.rutEmisor}-${d.tipoDte}-${d.folio}`} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-3 py-1.5">{d.fechaEmision}</td>
                    <td className="px-3 py-1.5">
                      {d.razonSocial ?? d.rutEmisor}
                      <span className="block text-xs text-gray-400">{d.rutEmisor}</span>
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      {d.nombreTipo} N° {d.folio}
                      {d.signo === -1 && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">
                          resta
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      {money.format(d.signo * (d.montoNeto + d.montoExento))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      {money.format(d.signo * d.montoTotal)}
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
              onClick={() => setDocumentos(null)}
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
