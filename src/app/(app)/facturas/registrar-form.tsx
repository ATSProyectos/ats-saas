"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { descartarDocumento, registrarDocumento } from "./actions";
import type { DestinoGasto, Regla } from "../cartola/reglas";
import type { Categoria } from "../cartola/clasificar-form";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export type DocumentoPendiente = {
  id: string;
  fechaEmision: string;
  razonSocial: string | null;
  rutEmisor: string;
  nombreTipo: string;
  folio: number;
  montoNeto: number;
  iva: number;
  montoTotal: number;
  signo: number;
  detalle: string | null;
  regla: Regla | null;
};

export function RegistrarForm({
  documento,
  categorias,
}: {
  documento: DocumentoPendiente;
  categorias: Categoria[];
}) {
  const router = useRouter();
  const regla = documento.regla;

  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState<DestinoGasto>(regla?.destino ?? "operacional");
  const [categoriaId, setCategoriaId] = useState(regla?.categoria_costo_id ?? "");
  const [recordar, setRecordar] = useState(regla === null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function handleRegistrar() {
    setError(null);
    if (destino === "excluir") return handleDescartar();
    if (!categoriaId) return setError("Elige una categoría.");

    setGuardando(true);
    const res = await registrarDocumento({
      documentoId: documento.id,
      destino,
      categoriaCostoId: categoriaId,
      // El RUT del emisor es el patrón natural: viene exacto en el XML y es
      // el mismo que la cartola extrae de la glosa, así que la regla sirve
      // para los dos importadores.
      patronRegla: recordar ? documento.rutEmisor.replace(/[.\-]/g, "").toLowerCase() : null,
      etiquetaRegla: recordar ? (documento.razonSocial ?? documento.rutEmisor) : null,
    });
    setGuardando(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleDescartar() {
    setGuardando(true);
    const res = await descartarDocumento(documento.id);
    setGuardando(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <>
      <tr className="border-t border-gray-100 align-top">
        <td className="whitespace-nowrap px-3 py-2">{documento.fechaEmision}</td>
        <td className="px-3 py-2">
          <div>{documento.razonSocial ?? "(sin razón social)"}</div>
          <div className="text-xs text-gray-400">{documento.rutEmisor}</div>
          {documento.detalle && (
            <div className="mt-0.5 text-xs text-gray-500">{documento.detalle}</div>
          )}
        </td>
        <td className="px-3 py-2 text-xs">
          {documento.nombreTipo}
          <div className="text-gray-400">N° {documento.folio}</div>
          {documento.signo === -1 && (
            <span className="rounded bg-amber-100 px-1 text-amber-800">resta</span>
          )}
        </td>
        <td className="px-3 py-2">
          {regla ? (
            <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-800">
              {regla.etiqueta}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Sin regla</span>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          {money.format(documento.signo * documento.montoTotal)}
          <div className="text-xs text-gray-400">
            neto {money.format(documento.signo * documento.montoNeto)}
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="text-sm text-gray-600 underline"
          >
            {abierto ? "Cerrar" : "Registrar"}
          </button>
        </td>
      </tr>

      {abierto && (
        <tr className="border-t border-gray-100 bg-gray-50">
          <td colSpan={6} className="px-3 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col text-xs text-gray-600">
                Destino
                <select
                  value={destino}
                  onChange={(e) => setDestino(e.target.value as DestinoGasto)}
                  className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="operacional">Gasto operacional</option>
                  <option value="administrativo">Gasto administrativo</option>
                  <option value="excluir">Descartar</option>
                </select>
              </label>

              {destino !== "excluir" && (
                <label className="flex flex-col text-xs text-gray-600">
                  Categoría
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="mt-1 min-w-64 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Elegir...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.categoria} / {c.subcategoria}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex items-center gap-1.5 pb-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={recordar}
                  onChange={(e) => setRecordar(e.target.checked)}
                />
                Recordar para este RUT
              </label>

              <div className="flex gap-2 pb-1">
                <button
                  type="button"
                  onClick={handleRegistrar}
                  disabled={guardando}
                  className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Confirmar"}
                </button>
                <button
                  type="button"
                  onClick={handleDescartar}
                  disabled={guardando}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                >
                  Descartar
                </button>
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </td>
        </tr>
      )}
    </>
  );
}
