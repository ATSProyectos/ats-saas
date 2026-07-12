import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export default async function VentasPage() {
  const supabase = await createClient();
  const { data: servicios, error } = await supabase
    .from("v_rentabilidad_servicio")
    .select("*")
    .order("fecha_servicio", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ventas / Servicios
          </h1>
          <p className="text-sm text-gray-500">
            Servicios vendidos y su rentabilidad.
          </p>
        </div>
        <Link
          href="/ventas/nueva"
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          + Nuevo servicio
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Fecha</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Cliente</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Operador</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Servicio</th>
              <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Ingreso neto</th>
              <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Costos directos</th>
              <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Margen bruto</th>
              <th className="whitespace-nowrap px-4 py-2 text-right font-medium">% Margen</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={9} className="px-4 py-4 text-red-600">
                  Error al cargar servicios: {error.message}
                </td>
              </tr>
            )}
            {servicios?.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-4 text-gray-400">
                  Aún no hay servicios registrados.
                </td>
              </tr>
            )}
            {servicios?.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-2">
                  {new Date(s.fecha_servicio).toLocaleDateString("es-CL")}
                </td>
                <td className="whitespace-nowrap px-4 py-2">{s.cliente}</td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                  {s.operador ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                  {s.servicio_tipo ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  {money.format(s.ingreso_neto)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-gray-500">
                  {money.format(s.costos_directos)}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-2 text-right font-medium ${
                    s.margen_bruto >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {money.format(s.margen_bruto)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-gray-500">
                  {s.pct_margen_bruto !== null ? `${s.pct_margen_bruto}%` : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <Link
                    href={`/ventas/${s.id}`}
                    className="text-gray-500 hover:text-black"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
