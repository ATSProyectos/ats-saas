"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { descartarMovimiento, registrarComoGasto } from "./actions";
import type { DestinoGasto, Regla } from "./reglas";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export type Categoria = { id: string; categoria: string; subcategoria: string };

export type MovimientoPendiente = {
  id: string;
  fecha: string;
  glosa: string;
  monto: number;
  tipo: "cargo" | "abono";
  rut: string | null;
  regla: Regla | null;
  patronSugerido: string;
  // Cuando el cargo calza con una factura ya registrada, es su pago y no un
  // gasto nuevo: registrarlo contaría el mismo costo dos veces.
  posibleDuplicado: string | null;
};

export function ClasificarForm({
  movimiento,
  categorias,
}: {
  movimiento: MovimientoPendiente;
  categorias: Categoria[];
}) {
  const router = useRouter();
  const regla = movimiento.regla;

  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState<DestinoGasto>(regla?.destino ?? "operacional");
  const [categoriaId, setCategoriaId] = useState(regla?.categoria_costo_id ?? "");
  const [proveedor, setProveedor] = useState(regla?.proveedor ?? "");
  const [conIva, setConIva] = useState(regla?.con_iva ?? true);
  const [recordar, setRecordar] = useState(regla === null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const neto = conIva ? Math.round(movimiento.monto / 1.19) : movimiento.monto;

  async function handleRegistrar() {
    setError(null);
    if (destino === "excluir") {
      setGuardando(true);
      const res = await descartarMovimiento(movimiento.id, null);
      setGuardando(false);
      if (res.error) return setError(res.error);
      router.refresh();
      return;
    }
    if (!categoriaId) return setError("Elige una categoría.");

    setGuardando(true);
    const res = await registrarComoGasto({
      movimientoId: movimiento.id,
      destino,
      categoriaCostoId: categoriaId,
      proveedor: proveedor.trim() || null,
      conIva,
      descripcion: movimiento.glosa,
      patronRegla: recordar ? movimiento.patronSugerido : null,
      etiquetaRegla: recordar ? proveedor.trim() || movimiento.glosa.slice(0, 60) : null,
    });
    setGuardando(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function handleDescartar() {
    setGuardando(true);
    const res = await descartarMovimiento(movimiento.id, null);
    setGuardando(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <>
      <tr className="border-t border-gray-100 align-top">
        <td className="whitespace-nowrap px-3 py-2">{movimiento.fecha}</td>
        <td className="px-3 py-2">
          <div>{movimiento.glosa}</div>
          {movimiento.rut && (
            <div className="text-xs text-gray-400">RUT {movimiento.rut}</div>
          )}
        </td>
        <td className="px-3 py-2">
          {movimiento.posibleDuplicado && (
            <div className="mb-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
              Posible pago de factura ya registrada · {movimiento.posibleDuplicado}
            </div>
          )}
          {regla ? (
            <div>
              <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-800">
                {regla.etiqueta}
              </span>
              {regla.destino === "excluir" && (
                <div className="mt-0.5 text-xs text-amber-700">No es gasto</div>
              )}
              {regla.nota && (
                <div className="mt-0.5 text-xs text-gray-500">{regla.nota}</div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">Sin regla</span>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right text-red-700">
          {money.format(movimiento.monto)}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="text-sm text-gray-600 underline"
          >
            {abierto ? "Cerrar" : "Clasificar"}
          </button>
        </td>
      </tr>

      {abierto && (
        <tr className="border-t border-gray-100 bg-gray-50">
          <td colSpan={5} className="px-3 py-3">
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
                  <option value="excluir">No es gasto (descartar)</option>
                </select>
              </label>

              {destino !== "excluir" && (
                <>
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

                  <label className="flex flex-col text-xs text-gray-600">
                    Proveedor
                    <input
                      value={proveedor}
                      onChange={(e) => setProveedor(e.target.value)}
                      className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>

                  <label className="flex items-center gap-1.5 pb-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={conIva}
                      onChange={(e) => setConIva(e.target.checked)}
                    />
                    Incluye IVA
                  </label>

                  <div className="pb-2 text-xs text-gray-500">
                    Neto {money.format(neto)} + IVA{" "}
                    {money.format(movimiento.monto - neto)}
                  </div>
                </>
              )}

              <label className="flex items-center gap-1.5 pb-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={recordar}
                  onChange={(e) => setRecordar(e.target.checked)}
                />
                Recordar para <code className="text-xs">{movimiento.patronSugerido}</code>
              </label>

              <div className="flex gap-2 pb-1">
                <button
                  type="button"
                  onClick={handleRegistrar}
                  disabled={guardando}
                  className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : destino === "excluir" ? "Descartar" : "Registrar"}
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
