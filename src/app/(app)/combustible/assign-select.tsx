"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignConsumo } from "./actions";

type ServicioOption = {
  id: string;
  label: string;
};

export function AssignSelect({
  consumoId,
  currentVentaId,
  servicios,
}: {
  consumoId: string;
  currentVentaId: string | null;
  servicios: ServicioOption[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentVentaId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await assignConsumo(consumoId, next || null);
      if (res.error) {
        setError(res.error);
        setValue(currentVentaId ?? "");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div>
      <select
        value={value}
        onChange={onChange}
        disabled={pending}
        className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
      >
        <option value="">— Sin asignar —</option>
        {servicios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-0.5 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
