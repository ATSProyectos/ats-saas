"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoAssignConsumosByFecha } from "./actions";

export function AutoAssignButton({ sinAsignar }: { sinAsignar: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const res = await autoAssignConsumosByFecha();
      if ("error" in res) {
        setMessage(`Error: ${res.error}`);
        return;
      }
      const partes = [`${res.movimientosAsignados} consumo(s) asignado(s) automáticamente al servicio pluma (HFSX24) del día`];
      if (res.fechasAmbiguas > 0) {
        partes.push(`${res.fechasAmbiguas} fecha(s) con más de un servicio pluma ese día (requieren asignación manual)`);
      }
      if (res.fechasSinServicio > 0) {
        partes.push(`${res.fechasSinServicio} fecha(s) sin ningún servicio pluma registrado`);
      }
      setMessage(partes.join(" · ") + ".");
      router.refresh();
    });
  }

  if (sinAsignar === 0) return null;

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        {pending ? "Asignando..." : `Auto-asignar por fecha (${sinAsignar} pendientes)`}
      </button>
      {message && <p className="mt-1 text-xs text-gray-500">{message}</p>}
    </div>
  );
}
