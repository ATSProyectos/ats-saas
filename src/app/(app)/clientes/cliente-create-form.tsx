"use client";

import { useActionState, useRef, useEffect } from "react";
import { createCliente, type ActionResult } from "./actions";

const initialState: ActionResult = {};

export function ClienteCreateForm() {
  const [state, formAction, pending] = useActionState(
    createCliente,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="nombre" className="mb-1 block text-sm font-medium">
          Nuevo cliente
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          placeholder="Nombre del cliente"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Guardando..." : "Agregar"}
      </button>
      {state.error && (
        <p className="ml-2 text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
