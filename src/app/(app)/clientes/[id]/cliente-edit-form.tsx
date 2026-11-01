"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateCliente, type ActionResult } from "../actions";

const initialState: ActionResult = {};

export function ClienteEditForm({
  id,
  nombre,
  diasPago,
}: {
  id: string;
  nombre: string;
  diasPago: number | null;
}) {
  const router = useRouter();
  const boundAction = updateCliente.bind(null, id);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState,
  );

  if (state.success) {
    router.push("/clientes");
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-sm">
      <div>
        <label htmlFor="nombre" className="mb-1 block text-sm font-medium">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          defaultValue={nombre}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="dias_pago" className="mb-1 block text-sm font-medium">
          Plazo de pago (días)
        </label>
        <input
          id="dias_pago"
          name="dias_pago"
          type="number"
          min={0}
          max={365}
          defaultValue={diasPago ?? ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">
          Días entre facturación y pago. En blanco, la fecha estimada de cada
          venta se digita a mano.
        </p>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/clientes")}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
