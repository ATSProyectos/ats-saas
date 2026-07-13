import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { MargenMensualChart } from "@/components/dashboard/margen-mensual-chart";
import { RentabilidadClienteChart } from "@/components/dashboard/rentabilidad-cliente-chart";
import { RealtimeRefresher } from "@/components/dashboard/realtime-refresher";
import { TipoServicioFilter } from "@/components/dashboard/tipo-servicio-filter";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

type ServicioRow = {
  fecha_servicio: string;
  cliente: string;
  servicio_tipo: string | null;
  ingreso_neto: number;
  costos_directos: number;
  margen_bruto: number;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const supabase = await createClient();

  // Traemos todos los servicios (con o sin filtro) y agregamos en el
  // servidor: a este volumen es más simple que mantener vistas SQL por
  // cada combinación de filtro.
  let query = supabase
    .from("v_rentabilidad_servicio")
    .select("fecha_servicio, cliente, servicio_tipo, ingreso_neto, costos_directos, margen_bruto");
  if (tipo) query = query.eq("servicio_tipo", tipo);

  const [{ data: servicios }, { data: todosLosServicios }] = await Promise.all([
    query,
    supabase.from("v_rentabilidad_servicio").select("servicio_tipo"),
  ]);

  const tipos = Array.from(
    new Set(
      (todosLosServicios ?? [])
        .map((s) => s.servicio_tipo)
        .filter((t): t is string => Boolean(t)),
    ),
  ).sort();

  const rows = (servicios ?? []) as ServicioRow[];

  // Agregado mensual (últimos 12 meses con datos).
  const porMes = new Map<
    string,
    { mes: string; ingreso_neto_total: number; margen_bruto_total: number; cantidad_servicios: number }
  >();
  for (const s of rows) {
    const mesKey = s.fecha_servicio.slice(0, 7) + "-01"; // YYYY-MM-01
    const acc = porMes.get(mesKey) ?? {
      mes: mesKey,
      ingreso_neto_total: 0,
      margen_bruto_total: 0,
      cantidad_servicios: 0,
    };
    acc.ingreso_neto_total += Number(s.ingreso_neto ?? 0);
    acc.margen_bruto_total += Number(s.margen_bruto ?? 0);
    acc.cantidad_servicios += 1;
    porMes.set(mesKey, acc);
  }
  const mensual = Array.from(porMes.values())
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .slice(-12);

  // Agregado por cliente.
  const porClienteMap = new Map<string, { cliente: string; margen_bruto_total: number }>();
  for (const s of rows) {
    const acc = porClienteMap.get(s.cliente) ?? { cliente: s.cliente, margen_bruto_total: 0 };
    acc.margen_bruto_total += Number(s.margen_bruto ?? 0);
    porClienteMap.set(s.cliente, acc);
  }
  const porCliente = Array.from(porClienteMap.values());

  const totales = rows.reduce(
    (acc, s) => ({
      ingreso: acc.ingreso + Number(s.ingreso_neto ?? 0),
      costos: acc.costos + Number(s.costos_directos ?? 0),
      margen: acc.margen + Number(s.margen_bruto ?? 0),
      servicios: acc.servicios + 1,
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Rentabilidad{tipo ? ` · ${tipo}` : ""}. Se actualiza en tiempo real.
          </p>
        </div>
        {tipos.length > 0 && <TipoServicioFilter tipos={tipos} />}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={`Ingreso neto${tipo ? " (filtrado)" : ""}`} value={money.format(totales.ingreso)} />
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
          <MargenMensualChart data={mensual} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Rentabilidad por cliente (top 8)
          </h2>
          <RentabilidadClienteChart data={porCliente} />
        </div>
      </div>
    </div>
  );
}
