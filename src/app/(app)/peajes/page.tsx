import { createClient } from "@/lib/supabase/server";
import { PeajeCsvUploadForm } from "./csv-upload-form";
import { PeajeManualForm } from "./manual-form";
import { AssignPeajeSelect } from "./assign-select";
import { AutoAssignButton } from "./auto-assign-button";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export default async function PeajesPage() {
  const supabase = await createClient();

  const [{ data: resumen }, { data: peajes }, { data: ventas }] =
    await Promise.all([
      supabase
        .from("v_peajes_diario")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(200),
      supabase
        .from("peajes_tag")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(500),
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
          Registro centralizado de movimientos de TAG y peajes. Los servicios
          con una única ejecución ese día se asignan solos; si hay más de un
          servicio el mismo día, se dejan para asignación manual.
        </p>
      </div>

      <PeajeCsvUploadForm />
      <PeajeManualForm />

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="rounded-md bg-gray-100 px-3 py-1">
          {peajes?.length ?? 0} movimientos · {money.format(total)}
        </span>
        {sinAsignar > 0 && (
          <span className="rounded-md bg-amber-100 px-3 py-1 text-amber-800">
            {sinAsignar} sin asignar
          </span>
        )}
        <AutoAssignButton sinAsignar={sinAsignar} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          Resumen diario
        </h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Fecha</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Concesionaria</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Movimientos</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Monto total</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Asignados</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Sin asignar</th>
              </tr>
            </thead>
            <tbody>
              {resumen?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-gray-400">
                    Aún no hay movimientos de TAG/peajes registrados.
                  </td>
                </tr>
              )}
              {resumen?.map((r) => (
                <tr
                  key={`${r.fecha}-${r.concesionaria}`}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    {new Date(r.fecha).toLocaleDateString("es-CL")}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.concesionaria ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {r.cantidad_movimientos}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium">
                    {money.format(r.monto_total)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-700">
                    {r.asignados}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-amber-700">
                    {r.sin_asignar}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="rounded-lg border border-gray-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-700">
          Detalle de movimientos (para asignación manual)
        </summary>
        <div className="overflow-x-auto border-t border-gray-200">
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
      </details>
    </div>
  );
}
