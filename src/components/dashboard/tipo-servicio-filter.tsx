"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function TipoServicioFilter({ tipos }: { tipos: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("tipo") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("tipo", value);
    else params.delete("tipo");
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="tipo-servicio" className="text-sm text-gray-500">
        Tipo de servicio
      </label>
      <select
        id="tipo-servicio"
        value={selected}
        onChange={onChange}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
      >
        <option value="">Todos</option>
        {tipos.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
