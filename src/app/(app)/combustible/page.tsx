import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "./upload-form";
import { AssignSelect } from "./assign-select";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const liters = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2,
});

export default async function CombustiblePage() {
  const supabase = await createClient();

  const [{ data: consumos }, { data: ventas }] = await Promise.all([
    supabase
      .from("consumos_combustible")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(300),
    supabase
      .from("ventas_servicios")
      .select("id, fecha_servicio, clientes(nombre)")
      .order("fecha_servicio", { ascending: false })
      .limit(200),
  ]);

  const servicios = (ventas ?? []).map((v) => {
    const cliente = Array.isArray(v.clientes)
      ? v.clientes[0]?.nombre
      : (v.clientes as { nombre: string } | null)?.nombre;
    return {
      id: v.id,
      label: `${new Date(v.fecha_servicio).toLocaleDateString("es-CL")} · ${cliente ?? "—"}`,
    };
  });

  const sinAsignar = (consumos ?? []).filter(
    (c) => !c.venta_servicio_id,
  ).length;
  const totalMonto = (consumos ?? []).reduce(
    (s, c) => s + Number(c.monto),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Combustible</h1>
        <p className="text-sm text-gray-500">
          Consumos de Copec importados. Asigna cada carga al servicio que
          corresponde: el costo de petróleo del servicio se actualiza solo.
        </p>
      </div>

      <UploadForm />

      <div className="flex gap-4 text-sm">
        <span className="rounded-md bg-gray-100 px-3 py-1">
          {consumos?.length ?? 0} consumos · {money.format(totalMonto)}
        </span>
        {sinAsignar > 0 && (
          <span className="rounded-md bg-amber-100 px-3 py-1 text-amber-800">
            {sinAsignar} sin asignar
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Fecha</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Estación</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Patente</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Litros</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Monto</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Odómetro</th>
              <th className="min-w-56 px-3 py-2 font-medium">Servicio asignado</th>
            </tr>
          </thead>
          <tbody>
            {consumos?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-gray-400">
                  Aún no hay consumos importados. Sube tu CSV de Copec arriba.
                </td>
              </tr>
            )}
            {consumos?.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0">
                <td className="whitespace-nowrap px-3 py-2">
                  {new Date(c.fecha).toLocaleDateString("es-CL")}
                </td>
                <td className="px-3 py-2 text-gray-600">{c.estacion ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {c.patente ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {c.volumen_litros !== null ? liters.format(c.volumen_litros) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {money.format(c.monto)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-500">
                  {c.odometro_km !== null ? c.odometro_km : "—"}
                </td>
                <td className="px-3 py-2">
                  <AssignSelect
                    consumoId={c.id}
                    currentVentaId={c.venta_servicio_id}
                    servicios={servicios}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
