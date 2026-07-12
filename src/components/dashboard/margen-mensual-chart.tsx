"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

type MonthlyRow = {
  mes: string;
  ingreso_neto_total: number;
  margen_bruto_total: number;
};

export function MargenMensualChart({ data }: { data: MonthlyRow[] }) {
  const formatted = data.map((d) => ({
    ...d,
    mesLabel: new Date(d.mes).toLocaleDateString("es-CL", {
      month: "short",
      year: "2-digit",
    }),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e1e0d9" />
          <XAxis
            dataKey="mesLabel"
            tick={{ fill: "#898781", fontSize: 12 }}
            axisLine={{ stroke: "#c3c2b7" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#898781", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${Math.round(v / 1_000_000)}M`}
          />
          <Tooltip
            formatter={(value) => money.format(Number(value))}
            contentStyle={{
              borderRadius: 8,
              borderColor: "#e1e0d9",
              fontSize: 13,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar
            dataKey="ingreso_neto_total"
            name="Ingreso neto"
            fill="#2a78d6"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="margen_bruto_total"
            name="Margen bruto"
            fill="#1baf7a"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
