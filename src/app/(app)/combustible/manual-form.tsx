"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createConsumoManual } from "./actions";

const initialState: { error?: string; success?: boolean } = {};

export function ConsumoManualForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createConsumoManual,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <details className="rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-gray-700">
        Agregar carga de combustible sin TCT (manual)
      </summary>
      <form
        ref={formRef}
        action={formAction}
        className="mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-5"
      >
        <div>
          <label htmlFor="m_fecha" className="mb-1 block text-xs font-medium text-gray-600">
            Fecha *
          </label>
          <input id="m_fecha" name="fecha" type="date" required className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="m_estacion" className="mb-1 block text-xs font-medium text-gray-600">
            Estación / detalle
          </label>
          <input id="m_estacion" name="estacion" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="m_patente" className="mb-1 block text-xs font-medium text-gray-600">
            Patente
          </label>
          <input id="m_patente" name="patente" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="m_litros" className="mb-1 block text-xs font-medium text-gray-600">
            Litros
          </label>
          <input id="m_litros" name="volumen_litros" type="number" min={0} step="0.01" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="m_monto" className="mb-1 block text-xs font-medium text-gray-600">
            Monto ($) *
          </label>
          <input id="m_monto" name="monto" type="number" min={0} step="1" required className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="col-span-2 sm:col-span-5">
          <button type="submit" disabled={pending} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
            {pending ? "Guardando..." : "Agregar carga sin TCT"}
          </button>
          {state.error && <span className="ml-2 text-sm text-red-600">{state.error}</span>}
        </div>
      </form>
    </details>
  );
}
