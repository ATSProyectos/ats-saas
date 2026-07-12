"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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

type ClienteRow = {
  cliente: string;
  margen_bruto_total: number;
};

export function RentabilidadClienteChart({ data }: { data: ClienteRow[] }) {
  const top = [...data]
    .sort((a, b) => b.margen_bruto_total - a.margen_bruto_total)
    .slice(0, 8);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={top}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} stroke="#e1e0d9" />
          <XAxis
            type="number"
            tick={{ fill: "#898781", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${Math.round(v / 1_000_000)}M`}
          />
          <YAxis
            type="category"
            dataKey="cliente"
            width={140}
            tick={{ fill: "#52514e", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => money.format(Number(value))}
            contentStyle={{
              borderRadius: 8,
              borderColor: "#e1e0d9",
              fontSize: 13,
            }}
          />
          <Bar dataKey="margen_bruto_total" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {top.map((entry) => (
              <Cell key={entry.cliente} fill="#2a78d6" />
            ))}
            <LabelList
              dataKey="margen_bruto_total"
              position="right"
              formatter={(v: unknown) => money.format(Number(v))}
              style={{ fill: "#52514e", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
