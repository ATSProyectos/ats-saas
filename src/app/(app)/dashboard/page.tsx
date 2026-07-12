import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { MargenMensualChart } from "@/components/dashboard/margen-mensual-chart";
import { RentabilidadClienteChart } from "@/components/dashboard/rentabilidad-cliente-chart";
import { RealtimeRefresher } from "@/components/dashboard/realtime-refresher";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: mensual }, { data: porCliente }] = await Promise.all([
    supabase
      .from("v_rentabilidad_mensual")
      .select("*")
      .order("mes", { ascending: true })
      .limit(12),
    supabase.from("v_rentabilidad_por_cliente").select("*"),
  ]);

  const totales = (mensual ?? []).reduce(
    (acc, m) => ({
      ingreso: acc.ingreso + Number(m.ingreso_neto_total ?? 0),
      costos: acc.costos + Number(m.costos_directos_total ?? 0),
      margen: acc.margen + Number(m.margen_bruto_total ?? 0),
      servicios: acc.servicios + Number(m.cantidad_servicios ?? 0),
    }),
    { ingreso: 0, costos: 0, margen: 0, servicios: 0 },
  );

  const pctMargenGlobal =
    totales.ingreso > 0
      ? Math.round((totales.margen / totales.ingreso) * 1000) / 10
      : null;

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresher />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Rentabilidad de los últimos 12 meses. Se actualiza en tiempo real.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Ingreso neto (12 meses)" value={money.format(totales.ingreso)} />
        <StatCard label="Costos directos" value={money.format(totales.costos)} />
        <StatCard
          label="Margen bruto"
          value={money.format(totales.margen)}
          tone={totales.margen >= 0 ? "good" : "bad"}
        />
        <StatCard
          label="% Margen global"
          value={pctMargenGlobal !== null ? `${pctMargenGlobal}%` : "—"}
          tone={pctMargenGlobal !== null && pctMargenGlobal >= 0 ? "good" : "bad"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Ingreso y margen por mes
          </h2>
          <MargenMensualChart data={mensual ?? []} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Rentabilidad por cliente (top 8)
          </h2>
          <RentabilidadClienteChart data={porCliente ?? []} />
        </div>
      </div>
    </div>
  );
}
