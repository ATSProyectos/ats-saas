"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPeajeManual } from "./actions";

const initialState: { error?: string; success?: boolean } = {};

export function PeajeManualForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createPeajeManual,
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
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-700">
        Agregar movimiento de TAG / peaje
      </h2>
      <form
        ref={formRef}
        action={formAction}
        className="mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-5"
      >
        <div>
          <label htmlFor="p_fecha" className="mb-1 block text-xs font-medium text-gray-600">
            Fecha *
          </label>
          <input id="p_fecha" name="fecha" type="date" required className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="p_conces" className="mb-1 block text-xs font-medium text-gray-600">
            Concesionaria
          </label>
          <input id="p_conces" name="concesionaria" placeholder="Autopista Central..." className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="p_patente" className="mb-1 block text-xs font-medium text-gray-600">
            Patente
          </label>
          <input id="p_patente" name="patente" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="p_desc" className="mb-1 block text-xs font-medium text-gray-600">
            Descripción
          </label>
          <input id="p_desc" name="descripcion" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor="p_monto" className="mb-1 block text-xs font-medium text-gray-600">
            Monto ($) *
          </label>
          <input id="p_monto" name="monto" type="number" min={0} step="1" required className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="col-span-2 sm:col-span-5">
          <button type="submit" disabled={pending} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
            {pending ? "Guardando..." : "Agregar movimiento"}
          </button>
          {state.error && <span className="ml-2 text-sm text-red-600">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
