import { createClient } from "@/lib/supabase/server";
import { CartolaUploadForm } from "./upload-form";
import { ClasificarForm, type Categoria, type MovimientoPendiente } from "./clasificar-form";
import { buscarRegla, patronSugerido, type Regla } from "./reglas";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

type MovimientoFila = {
  id: string;
  fecha: string;
  glosa: string;
  monto: number;
  tipo: "cargo" | "abono";
  rut: string | null;
  estado: string;
};

export default async function CartolaPage() {
  const supabase = await createClient();

  const [{ data: movimientos }, { data: reglas }, { data: categorias }, { data: duplicados }] =
    await Promise.all([
    supabase
      .from("cartola_movimientos")
      .select("id, fecha, glosa, monto, tipo, rut, estado")
      .order("fecha", { ascending: false }),
    supabase
      .from("reglas_clasificacion")
      .select("id, patron, etiqueta, proveedor, destino, categoria_costo_id, con_iva, nota"),
    supabase
      .from("categorias_costo")
      .select("id, categoria, subcategoria")
      .order("categoria")
      .order("subcategoria"),
    supabase
      .from("v_cartola_posible_duplicado")
      .select("movimiento_id, razon_social, tipo_dte, folio, monto_total"),
  ]);

  const filas = (movimientos ?? []) as MovimientoFila[];
  const catalogo = (reglas ?? []) as Regla[];
  const opciones = (categorias ?? []) as Categoria[];

  // Un cargo que calza con una factura ya registrada es el PAGO de ese gasto,
  // no un gasto nuevo. Registrarlo lo contaría dos veces.
  const avisoDuplicado = new Map<string, string>();
  for (const d of (duplicados ?? []) as {
    movimiento_id: string;
    razon_social: string | null;
    tipo_dte: number;
    folio: number;
    monto_total: number;
  }[]) {
    avisoDuplicado.set(
      d.movimiento_id,
      `Ya registrado como ${d.razon_social ?? "documento"} folio ${d.folio}`,
    );
  }

  // Solo los cargos pendientes piden decisión: un abono es un ingreso y se
  // registra desde Ventas, no como gasto.
  const pendientes: MovimientoPendiente[] = filas
    .filter((m) => m.estado === "pendiente" && m.tipo === "cargo")
    .map((m) => ({
      id: m.id,
      fecha: m.fecha,
      glosa: m.glosa,
      monto: Number(m.monto),
      tipo: m.tipo,
      rut: m.rut,
      regla: buscarRegla(m, catalogo),
      patronSugerido: patronSugerido(m),
      posibleDuplicado: avisoDuplicado.get(m.id) ?? null,
    }));

  const conRegla = pendientes.filter((m) => m.regla !== null).length;
  const abonosPendientes = filas.filter(
    (m) => m.estado === "pendiente" && m.tipo === "abono",
  );
  const registrados = filas.filter((m) => m.estado === "registrado").length;
  const descartados = filas.filter((m) => m.estado === "descartado").length;
  const totalPendiente = pendientes.reduce((a, m) => a + m.monto, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cartola bancaria</h1>
        <p className="text-sm text-gray-500">
          Importa la cartola, revisa lo que el sistema propone y registra los
          cargos como gasto. Cada clasificación queda aprendida.
        </p>
      </div>

      <CartolaUploadForm />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tarjeta label="Cargos por revisar" valor={String(pendientes.length)} />
        <Tarjeta label="Monto pendiente" valor={money.format(totalPendiente)} />
        <Tarjeta
          label="Con regla conocida"
          valor={`${conRegla} de ${pendientes.length}`}
        />
        <Tarjeta label="Ya resueltos" valor={`${registrados} + ${descartados} descartados`} />
      </div>

      {abonosPendientes.length > 0 && (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          Hay {abonosPendientes.length} abono(s) en la cartola. No aparecen acá
          porque son ingresos: se registran desde Ventas.
        </p>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
          Cargos por clasificar
        </h2>
        {pendientes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No hay cargos pendientes. Importa una cartola para empezar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Glosa</th>
                  <th className="px-3 py-2">Propuesta</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {pendientes.map((m) => (
                  <ClasificarForm key={m.id} movimiento={m} categorias={opciones} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Tarjeta({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight">{valor}</div>
    </div>
  );
}
