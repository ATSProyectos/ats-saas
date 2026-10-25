import { createClient } from "@/lib/supabase/server";
import {
  GastoAdministrativoForm,
  GastoOperacionalForm,
  type CategoriaEerr,
} from "./gasto-forms";
import { DeleteGastoButton } from "./delete-gasto-button";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

type GastoListado = {
  id: string;
  fecha: string;
  origen: "operacional" | "administrativo";
  categoria: string;
  detalle: string;
  monto_neto: number;
  medio_pago: string | null;
};


export default async function GastosPage() {
  const supabase = await createClient();

  const [{ data: categorias }, { data: operacionales }, { data: administrativos }] =
    await Promise.all([
      supabase
        .from("v_categorias_eerr")
        .select("*")
        .order("categoria")
        .order("subcategoria"),
      supabase
        .from("gastos_operacionales")
        .select(
          "id, fecha, proveedor, descripcion, monto_neto, medio_pago, categoria_costo_id",
        )
        .order("fecha", { ascending: false })
        .limit(60),
      supabase
        .from("gastos_administrativos")
        .select(
          "id, fecha, descripcion, monto_neto, medio_pago, categoria_costo_id",
        )
        .order("fecha", { ascending: false })
        .limit(60),
    ]);

  // El nombre de la categoría se resuelve contra el catálogo que ya trajimos
  // para los formularios, en vez de pedirlo otra vez como recurso anidado.
  const nombrePorCategoria = new Map(
    ((categorias ?? []) as CategoriaEerr[]).map((c) => [
      c.id,
      `${c.categoria} / ${c.subcategoria}`,
    ]),
  );

  function nombreCategoria(id: string | null): string {
    return (id && nombrePorCategoria.get(id)) || "Sin categoría";
  }

  const listado: GastoListado[] = [
    ...(operacionales ?? []).map((g) => ({
      id: g.id as string,
      fecha: g.fecha as string,
      origen: "operacional" as const,
      categoria: nombreCategoria(g.categoria_costo_id as string | null),
      detalle:
        (g.proveedor as string | null) ?? (g.descripcion as string | null) ?? "—",
      monto_neto: Number(g.monto_neto ?? 0),
      medio_pago: g.medio_pago as string | null,
    })),
    ...(administrativos ?? []).map((g) => ({
      id: g.id as string,
      fecha: g.fecha as string,
      origen: "administrativo" as const,
      categoria: nombreCategoria(g.categoria_costo_id as string | null),
      detalle: (g.descripcion as string | null) ?? "—",
      monto_neto: Number(g.monto_neto ?? 0),
      medio_pago: g.medio_pago as string | null,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gastos</h1>
        <p className="text-sm text-gray-500">
          Costos que no se cargan a un servicio puntual. Alimentan los niveles 3
          y 4 del estado de resultados. Montos netos: el IVA es crédito, no
          costo.
        </p>
      </div>

      <GastoOperacionalForm categorias={(categorias ?? []) as CategoriaEerr[]} />
      <GastoAdministrativoForm
        categorias={(categorias ?? []) as CategoriaEerr[]}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Fecha</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Tipo</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">
                Categoría
              </th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">
                Proveedor / detalle
              </th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">
                Medio de pago
              </th>
              <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                Monto neto
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {listado.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-gray-400">
                  Aún no hay gastos cargados. Mientras esta tabla esté vacía, el
                  estado de resultados solo llega hasta el margen bruto.
                </td>
              </tr>
            )}
            {listado.map((g) => (
              <tr
                key={`${g.origen}-${g.id}`}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="whitespace-nowrap px-4 py-2">
                  {new Date(g.fecha).toLocaleDateString("es-CL")}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                  {g.origen === "operacional" ? "Operacional" : "Administrativo"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                  {g.categoria}
                </td>
                <td className="px-4 py-2">{g.detalle}</td>
                <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                  {g.medio_pago ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                  {money.format(g.monto_neto)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <DeleteGastoButton id={g.id} origen={g.origen} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
