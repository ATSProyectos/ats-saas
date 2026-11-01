import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const mesLargo = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" });

type Compromiso = {
  id: string;
  origen: string;
  fecha: string;
  categoria: string | null;
  subcategoria: string | null;
  proveedor: string | null;
  descripcion: string | null;
  total: number;
  estado_pago: "por_pagar" | "comprometido";
  fecha_estimada_pago: string | null;
  vencido: boolean | null;
  dias_restantes: number | null;
  mes_pago: string;
};

type Cobro = {
  id: string;
  cliente: string;
  n_factura: string | null;
  fecha_facturacion: string | null;
  fecha_estimada_pago: string | null;
  monto: number;
  vencido: boolean | null;
  dias_restantes: number | null;
  mes_cobro: string | null;
};

type Cuota = {
  id: string;
  nombre: string;
  numero: number;
  cuotas_totales: number;
  fecha_vencimiento: string;
  monto: number;
  vencida: boolean | null;
  mes_pago: string;
};

const ETIQUETA_ESTADO: Record<string, string> = {
  por_pagar: "Por pagar",
  comprometido: "Comprometido",
};

export default async function PagosPage() {
  const supabase = await createClient();

  const [{ data }, { data: cobros }, { data: cuotasData }] = await Promise.all([
    supabase
      .from("v_calendario_pagos")
      .select(
        "id, origen, fecha, categoria, subcategoria, proveedor, descripcion, total, estado_pago, fecha_estimada_pago, vencido, dias_restantes, mes_pago",
      )
      .order("fecha_estimada_pago", { ascending: true, nullsFirst: false }),
    supabase
      .from("v_cobranza")
      .select(
        "id, cliente, n_factura, fecha_facturacion, fecha_estimada_pago, monto, vencido, dias_restantes, mes_cobro",
      )
      .order("fecha_estimada_pago", { ascending: true, nullsFirst: false }),
    supabase
      .from("v_cuotas_pendientes")
      .select("id, nombre, numero, cuotas_totales, fecha_vencimiento, monto, vencida, mes_pago")
      .order("fecha_vencimiento", { ascending: true }),
  ]);

  const compromisos = (data ?? []) as Compromiso[];
  const cobranza = (cobros ?? []) as Cobro[];
  const cuotas = (cuotasData ?? []) as Cuota[];

  const porCobrar = cobranza.reduce((a, c) => a + Number(c.monto), 0);
  const cobroVencido = cobranza
    .filter((c) => c.vencido)
    .reduce((a, c) => a + Number(c.monto), 0);

  // Las cuotas son salida de caja pero no gasto: la amortización de capital va
  // contra deuda, no contra resultado. Por eso suman al flujo y no al EERR.
  const deudaCuotas = cuotas.reduce((a, c) => a + Number(c.monto), 0);
  const cuotasProximas = cuotas.slice(0, 6);
  const cuotasEn12Meses = cuotas
    .filter((c) => {
      const limite = new Date();
      limite.setFullYear(limite.getFullYear() + 1);
      return new Date(`${c.fecha_vencimiento}T00:00:00`) <= limite;
    })
    .reduce((a, c) => a + Number(c.monto), 0);

  const vencidos = compromisos.filter((c) => c.vencido);
  const total = compromisos.reduce((a, c) => a + Number(c.total), 0);
  const totalVencido = vencidos.reduce((a, c) => a + Number(c.total), 0);

  const en30 = compromisos.filter(
    (c) => !c.vencido && c.dias_restantes !== null && c.dias_restantes <= 30,
  );
  const totalEn30 = en30.reduce((a, c) => a + Number(c.total), 0);

  // Agrupado por mes de pago: es la vista que sirve para prever fondos.
  const porMes = new Map<string, { mes: string; total: number; items: Compromiso[] }>();
  for (const c of compromisos) {
    const clave = c.mes_pago;
    const grupo = porMes.get(clave) ?? { mes: clave, total: 0, items: [] };
    grupo.total += Number(c.total);
    grupo.items.push(c);
    porMes.set(clave, grupo);
  }
  const meses = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pagos y cobranza</h1>
        <p className="text-sm text-gray-500">
          Lo que hay que pagar y lo que está por cobrar, cada uno en su fecha
          estimada. Es proyección: no incluye el saldo en cuenta ni las cuotas
          de leasing, que todavía no se modelan.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tarjeta
          label="Por cobrar"
          valor={money.format(porCobrar)}
          detalle={`${cobranza.length} factura(s)`}
        />
        <Tarjeta
          label="Por pagar"
          valor={money.format(total)}
          detalle={`${compromisos.length} compromiso(s)`}
        />
        <Tarjeta
          label="Saldo proyectado"
          valor={money.format(porCobrar - total - cuotasEn12Meses)}
          detalle="cobranza menos gastos y cuotas a 12 meses"
          alerta={porCobrar - total - cuotasEn12Meses < 0}
        />
        <Tarjeta
          label="Vencido"
          valor={money.format(cobroVencido + totalVencido)}
          detalle={`cobrar ${money.format(cobroVencido)} · pagar ${money.format(totalVencido)}`}
          alerta={cobroVencido + totalVencido > 0}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Por cobrar · próximos 30 días
          </h2>
          <span className="text-xs text-gray-500">
            {money.format(totalEn30)} por pagar en el mismo plazo
          </span>
        </div>
        {cobranza.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No hay facturas pendientes de cobro.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Fecha estimada</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Factura</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {cobranza.slice(0, 15).map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-3 py-2">
                      {c.fecha_estimada_pago ?? "—"}
                      {c.vencido && (
                        <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                          vencida
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{c.cliente}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {c.n_factura ?? "sin n°"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-green-700">
                      {money.format(Number(c.monto))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cobranza.length > 15 && (
              <p className="px-3 py-2 text-xs text-gray-400">
                y {cobranza.length - 15} factura(s) más
              </p>
            )}
          </div>
        )}
      </div>

      {cuotas.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Cuotas de financiamiento
            </h2>
            <span className="text-xs text-gray-500">
              {cuotas.length} cuotas por {money.format(deudaCuotas)} ·{" "}
              {money.format(cuotasEn12Meses)} en los próximos 12 meses
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Vencimiento</th>
                  <th className="px-3 py-2">Crédito</th>
                  <th className="px-3 py-2">Cuota</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {cuotasProximas.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-3 py-2">
                      {c.fecha_vencimiento}
                      {c.vencida && (
                        <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                          vencida
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{c.nombre}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {c.numero} de {c.cuotas_totales}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {money.format(Number(c.monto))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
            Las cuotas salen de la caja pero no son gasto: la amortización de
            capital va contra la deuda, no contra el resultado. Por eso suman
            acá y no en el estado de resultados.
          </p>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-700">
        Compromisos de pago por mes
      </h2>

      {compromisos.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
          No hay compromisos pendientes. Un gasto llega acá cuando lo registras
          como «por pagar» o «comprometido» en{" "}
          <Link href="/gastos" className="underline">
            Gastos
          </Link>{" "}
          o al registrar una factura en{" "}
          <Link href="/facturas" className="underline">
            Facturas
          </Link>
          .
        </p>
      ) : (
        meses.map((grupo) => (
          <div key={grupo.mes} className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold capitalize text-gray-700">
                {mesLargo.format(new Date(`${grupo.mes}T00:00:00`))}
              </h2>
              <span className="text-sm font-medium">{money.format(grupo.total)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Fecha estimada</th>
                    <th className="px-3 py-2">Proveedor / detalle</th>
                    <th className="px-3 py-2">Categoría</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.items.map((c) => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-3 py-2">
                        {c.fecha_estimada_pago ?? "—"}
                        {c.vencido && (
                          <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                            vencido
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {c.proveedor ?? c.descripcion ?? "—"}
                        {c.proveedor && c.descripcion && (
                          <span className="block text-xs text-gray-400">
                            {c.descripcion}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {c.categoria ?? "Sin categoría"}
                        {c.subcategoria ? ` / ${c.subcategoria}` : ""}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {ETIQUETA_ESTADO[c.estado_pago] ?? c.estado_pago}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {money.format(Number(c.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Tarjeta({
  label,
  valor,
  detalle,
  alerta,
}: {
  label: string;
  valor: string;
  detalle?: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 ${
        alerta ? "border-red-200" : "border-gray-200"
      }`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold tracking-tight ${
          alerta ? "text-red-700" : ""
        }`}
      >
        {valor}
      </div>
      {detalle && <div className="mt-0.5 text-xs text-gray-400">{detalle}</div>}
    </div>
  );
}
