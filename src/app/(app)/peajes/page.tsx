import { createClient } from "@/lib/supabase/server";
import { PeajeManualForm } from "./manual-form";
import { AssignPeajeSelect } from "./assign-select";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export default async function PeajesPage() {
  const supabase = await createClient();

  const [{ data: peajes }, { data: ventas }] = await Promise.all([
    supabase
      .from("peajes_tag")
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

  const sinAsignar = (peajes ?? []).filter((p) => !p.venta_servicio_id).length;
  const total = (peajes ?? []).reduce((s, p) => s + Number(p.monto), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Peajes y TAG</h1>
        <p className="text-sm text-gray-500">
          Registro centralizado de movimientos de TAG y peajes. Asigna cada uno
          al servicio: el costo de TAG/peajes del servicio se actualiza solo.
        </p>
      </div>

      <PeajeManualForm />

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
        <strong>Importación por CSV de concesionarias (próximamente):</strong> en
        cuanto me compartas un CSV de ejemplo de cada concesionaria que usas
        (Autopista Central, Costanera Norte, Vespucio, etc.), agrego la carga
        automática aquí, igual que en Combustible.
      </div>

      <div className="flex gap-4 text-sm">
        <span className="rounded-md bg-gray-100 px-3 py-1">
          {peajes?.length ?? 0} movimientos · {money.format(total)}
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
              <th className="whitespace-nowrap px-3 py-2 font-medium">Concesionaria</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Patente</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Descripción</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Monto</th>
              <th className="min-w-56 px-3 py-2 font-medium">Servicio asignado</th>
            </tr>
          </thead>
          <tbody>
            {peajes?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-gray-400">
                  Aún no hay movimientos de TAG/peajes registrados.
                </td>
              </tr>
            )}
            {peajes?.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0">
                <td className="whitespace-nowrap px-3 py-2">
                  {new Date(p.fecha).toLocaleDateString("es-CL")}
                </td>
                <td className="px-3 py-2 text-gray-600">{p.concesionaria ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {p.patente ?? "—"}
                </td>
                <td className="px-3 py-2 text-gray-500">{p.descripcion ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {money.format(p.monto)}
                </td>
                <td className="px-3 py-2">
                  <AssignPeajeSelect
                    peajeId={p.id}
                    currentVentaId={p.venta_servicio_id}
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
