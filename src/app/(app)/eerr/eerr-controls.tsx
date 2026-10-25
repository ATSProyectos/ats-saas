"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function EerrControls({
  meses,
  mesSeleccionado,
  etiquetas,
  vista,
}: {
  meses: string[];
  mesSeleccionado: string;
  etiquetas: Record<string, string>;
  vista: "consolidado" | "tipo";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navegar(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    router.push(`/eerr?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="eerr-mes" className="text-sm text-gray-500">
          Mes
        </label>
        <select
          id="eerr-mes"
          value={mesSeleccionado}
          onChange={(e) => navegar({ mes: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          {meses.map((m) => (
            <option key={m} value={m}>
              {etiquetas[m] ?? m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
        <button
          type="button"
          onClick={() => navegar({ vista: "" })}
          className={
            vista === "consolidado"
              ? "bg-black px-3 py-1.5 text-white"
              : "px-3 py-1.5 text-gray-600 hover:text-black"
          }
        >
          Consolidado
        </button>
        <button
          type="button"
          onClick={() => navegar({ vista: "tipo" })}
          className={
            vista === "tipo"
              ? "bg-black px-3 py-1.5 text-white"
              : "px-3 py-1.5 text-gray-600 hover:text-black"
          }
        >
          Por tipo de servicio
        </button>
      </div>
    </div>
  );
}
