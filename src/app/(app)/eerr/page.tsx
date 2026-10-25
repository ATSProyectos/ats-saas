import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { EerrControls } from "./eerr-controls";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// El mes llega como 'YYYY-MM-DD'. Se parte el string en vez de usar
// new Date(mes): esa ruta interpreta UTC y en Chile devuelve el mes anterior.
function etiquetaMes(mes: string): string {
  const [anio, numero] = mes.split("-");
  return `${NOMBRE_MES[Number(numero) - 1]} ${anio}`;
}

function mesAnteriorDe(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  const fecha = new Date(anio, numero - 2, 1);
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${fecha.getFullYear()}-${mm}-01`;
}

type EerrRow = {
  mes: string;
  codigo: string;
  nombre: string;
  grupo: string;
  tipo: string;
  orden: number;
  nota: string | null;
  monto: number;
  pct_ingresos: number | null;
};

// La vista por tipo no trae la columna nota: la etiqueta de cada línea se
// toma del consolidado.
type EerrTipoRow = Omit<EerrRow, "nota"> & { servicio_tipo: string };

type ControlRow = {
  alerta: string;
  mes: string | null;
  detalle: string;
  cantidad: number;
  monto: number | null;
};

const TITULO_ALERTA: Record<string, string> = {
  categoria_sin_mapeo: "Categoría sin línea asignada",
  gasto_sin_categoria: "Gasto cargado sin categoría",
  posible_doble_conteo: "Posible doble conteo con los costos directos",
  iva_dentro_de_costos: "IVA dentro de los costos de combustible y peajes",
  tipo_servicio_duplicado: "Tipo de servicio escrito de más de una forma",
};

function claseFila(codigo: string, tipo: string): string {
  if (tipo !== "subtotal") return "border-b border-gray-100";
  if (codigo === "T7") return "border-y-2 border-black bg-gray-50 font-bold";
  if (codigo === "T3" || codigo === "T5") {
    return "border-t-2 border-gray-400 font-semibold";
  }
  return "border-t border-gray-300 font-semibold";
}

function toneDe(monto: number): "good" | "bad" {
  return monto >= 0 ? "good" : "bad";
}

export default async function EerrPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; vista?: string }>;
}) {
  const { mes: mesParam, vista: vistaParam } = await searchParams;
  const vista = vistaParam === "tipo" ? "tipo" : "consolidado";
  const supabase = await createClient();

  // Una fila por mes con datos: T1 existe siempre que el mes tenga movimientos.
  const { data: mesesData, error: errorMeses } = await supabase
    .from("v_eerr_mensual")
    .select("mes")
    .eq("codigo", "T1")
    .order("mes", { ascending: false });

  if (errorMeses) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No se pudo cargar el estado de resultados: {errorMeses.message}
      </div>
    );
  }

  const meses = (mesesData ?? []).map((r) => r.mes as string);

  if (meses.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Estado de resultados
        </h1>
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Todavía no hay movimientos para construir el reporte. Carga servicios
          en Ventas y costos en Gastos.
        </p>
      </div>
    );
  }

  const mes = mesParam && meses.includes(mesParam) ? mesParam : meses[0];
  const anio = mes.slice(0, 4);
  const mesAnterior = mesAnteriorDe(mes);

  const [
    { data: delAnio },
    { data: delMesAnterior },
    { data: delTipo },
    { data: alertas },
  ] = await Promise.all([
    supabase
      .from("v_eerr_mensual")
      .select("*")
      .gte("mes", `${anio}-01-01`)
      .lte("mes", mes),
    supabase
      .from("v_eerr_mensual")
      .select("codigo, monto")
      .eq("mes", mesAnterior),
    supabase.from("v_eerr_mensual_tipo").select("*").eq("mes", mes),
    supabase.from("v_eerr_control").select("*"),
  ]);

  const filasAnio = (delAnio ?? []) as EerrRow[];
  const filasMes = filasAnio
    .filter((r) => r.mes === mes)
    .sort((a, b) => a.orden - b.orden);

  // Acumulado del año hasta el mes seleccionado. Los subtotales son aditivos
  // entre meses, así que se suman igual que las líneas de detalle.
  const acumulado = new Map<string, number>();
  for (const fila of filasAnio) {
    acumulado.set(
      fila.codigo,
      (acumulado.get(fila.codigo) ?? 0) + Number(fila.monto ?? 0),
    );
  }

  const anterior = new Map(
    (delMesAnterior ?? []).map((r) => [r.codigo as string, Number(r.monto ?? 0)]),
  );

  const montoDe = (codigo: string) =>
    Number(filasMes.find((f) => f.codigo === codigo)?.monto ?? 0);
  const pctDe = (codigo: string) =>
    filasMes.find((f) => f.codigo === codigo)?.pct_ingresos ?? null;

  const etiquetas = Object.fromEntries(meses.map((m) => [m, etiquetaMes(m)]));

  const alertasDelMes = ((alertas ?? []) as ControlRow[]).filter(
    (a) => a.mes === mes || a.mes === null,
  );

  const excluidas = filasMes.filter((f) => f.grupo === "excluido" && f.monto !== 0);
  const visibles = filasMes.filter((f) => {
    if (f.grupo === "excluido") return false;
    if (f.tipo === "subtotal") return true;
    return (
      Number(f.monto) !== 0 ||
      (anterior.get(f.codigo) ?? 0) !== 0 ||
      (acumulado.get(f.codigo) ?? 0) !== 0
    );
  });

  // --- Matriz por tipo de servicio ---
  const filasTipo = (delTipo ?? []) as EerrTipoRow[];
  const tipos = Array.from(new Set(filasTipo.map((f) => f.servicio_tipo))).sort();
  const porCodigoTipo = new Map<string, Map<string, EerrTipoRow>>();
  for (const fila of filasTipo) {
    const porTipo = porCodigoTipo.get(fila.codigo) ?? new Map();
    porTipo.set(fila.servicio_tipo, fila);
    porCodigoTipo.set(fila.codigo, porTipo);
  }
  const lineasTipo = visibles.filter((f) => {
    const porTipo = porCodigoTipo.get(f.codigo);
    if (!porTipo) return f.tipo === "subtotal";
    if (f.tipo === "subtotal") return true;
    return Array.from(porTipo.values()).some((r) => Number(r.monto) !== 0);
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Estado de resultados
          </h1>
          <p className="text-sm text-gray-500">
            {etiquetaMes(mes)} · devengado por fecha de servicio · montos netos,
            sin IVA
          </p>
        </div>
        <EerrControls
          meses={meses}
          mesSeleccionado={mes}
          etiquetas={etiquetas}
          vista={vista}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Ingresos netos"
          value={money.format(montoDe("T1"))}
        />
        <StatCard
          label={`Margen bruto${pctDe("T3") !== null ? ` · ${pctDe("T3")}%` : ""}`}
          value={money.format(montoDe("T3"))}
          tone={toneDe(montoDe("T3"))}
        />
        <StatCard
          label="Resultado de flota"
          value={money.format(montoDe("T5"))}
          tone={toneDe(montoDe("T5"))}
        />
        <StatCard
          label={`EBITDA${pctDe("T7") !== null ? ` · ${pctDe("T7")}%` : ""}`}
          value={money.format(montoDe("T7"))}
          tone={toneDe(montoDe("T7"))}
        />
      </div>

      {alertasDelMes.length > 0 && (
        <details className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-amber-900">
            Control de datos · {alertasDelMes.length}{" "}
            {alertasDelMes.length === 1 ? "aviso" : "avisos"} por revisar
          </summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-amber-900">
            {alertasDelMes.map((a, i) => (
              <li key={`${a.alerta}-${i}`}>
                <span className="font-medium">
                  {TITULO_ALERTA[a.alerta] ?? a.alerta}
                </span>
                : {a.detalle}
                {a.monto !== null && ` · ${money.format(Number(a.monto))}`}
                {a.cantidad > 1 && ` · ${a.cantidad} registros`}
              </li>
            ))}
          </ul>
        </details>
      )}

      {vista === "consolidado" ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Línea</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  {etiquetaMes(mes)}
                </th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  % s/ingreso
                </th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  {etiquetaMes(mesAnterior)}
                </th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  Variación
                </th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  Acumulado {anio}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => {
                const montoMes = Number(fila.monto);
                const montoPrevio = anterior.get(fila.codigo) ?? 0;
                const variacion = montoMes - montoPrevio;
                const pctVariacion =
                  montoPrevio !== 0
                    ? Math.round((variacion / Math.abs(montoPrevio)) * 1000) / 10
                    : null;

                return (
                  <tr key={fila.codigo} className={claseFila(fila.codigo, fila.tipo)}>
                    <td className="px-4 py-2" title={fila.nota ?? undefined}>
                      <span className="mr-2 text-xs text-gray-400 tabular-nums">
                        {fila.tipo === "subtotal" ? "" : fila.codigo}
                      </span>
                      {fila.nombre}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                      {money.format(montoMes)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-gray-500 tabular-nums">
                      {fila.pct_ingresos !== null ? `${fila.pct_ingresos}%` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-gray-500 tabular-nums">
                      {money.format(montoPrevio)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-gray-500">
                      {pctVariacion !== null ? `${pctVariacion > 0 ? "+" : ""}${pctVariacion}%` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                      {money.format(acumulado.get(fila.codigo) ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Línea</th>
                {tipos.map((t) => (
                  <th
                    key={t}
                    className="whitespace-nowrap px-4 py-2 text-right font-medium"
                  >
                    {t}
                  </th>
                ))}
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {lineasTipo.map((fila) => {
                const porTipo = porCodigoTipo.get(fila.codigo);
                const valores = tipos.map((t) =>
                  Number(porTipo?.get(t)?.monto ?? 0),
                );
                const total = valores.reduce((a, b) => a + b, 0);

                return (
                  <tr key={fila.codigo} className={claseFila(fila.codigo, fila.tipo)}>
                    <td className="px-4 py-2" title={fila.nota ?? undefined}>
                      <span className="mr-2 text-xs text-gray-400 tabular-nums">
                        {fila.tipo === "subtotal" ? "" : fila.codigo}
                      </span>
                      {fila.nombre}
                    </td>
                    {valores.map((valor, i) => (
                      <td
                        key={tipos[i]}
                        className="whitespace-nowrap px-4 py-2 text-right tabular-nums"
                      >
                        {money.format(valor)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                      {money.format(total)}
                    </td>
                  </tr>
                );
              })}
              {["T3", "T7"].map((codigo) => {
                const porTipo = porCodigoTipo.get(codigo);
                const etiqueta =
                  codigo === "T3" ? "% Margen bruto" : "% EBITDA";
                return (
                  <tr key={`pct-${codigo}`} className="border-t border-gray-200 text-gray-500">
                    <td className="px-4 py-2">{etiqueta}</td>
                    {tipos.map((t) => {
                      const pct = porTipo?.get(t)?.pct_ingresos ?? null;
                      return (
                        <td
                          key={t}
                          className="whitespace-nowrap px-4 py-2 text-right tabular-nums"
                        >
                          {pct !== null ? `${pct}%` : "—"}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                      {pctDe(codigo) !== null ? `${pctDe(codigo)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            Los costos indirectos de operación y los gastos de administración no
            son atribuibles a un servicio puntual: se prorratean por
            participación en los ingresos netos del mes.
          </p>
        </div>
      )}

      {excluidas.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            Fuera del resultado del mes · {excluidas.length}{" "}
            {excluidas.length === 1 ? "línea" : "líneas"}
          </summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-gray-600">
            {excluidas.map((fila) => (
              <li key={fila.codigo} className="flex justify-between gap-4">
                <span>
                  {fila.nombre}
                  {fila.nota && (
                    <span className="block text-xs text-gray-400">{fila.nota}</span>
                  )}
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  {money.format(Number(fila.monto))}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
