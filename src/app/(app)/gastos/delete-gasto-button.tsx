"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGastoAdministrativo, deleteGastoOperacional } from "./actions";

export function DeleteGastoButton({
  id,
  origen,
}: {
  id: string;
  origen: "operacional" | "administrativo";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function onClick() {
    if (!confirm("¿Eliminar este gasto? La acción queda registrada en la auditoría.")) {
      return;
    }
    startTransition(async () => {
      const result =
        origen === "operacional"
          ? await deleteGastoOperacional(id)
          : await deleteGastoAdministrativo(id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
      >
        {pending ? "..." : "Eliminar"}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </>
  );
}
