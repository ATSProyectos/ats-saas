import { createClient } from "@/lib/supabase/server";
import { FacturasUploadForm } from "./upload-form";
import { RegistrarForm, type DocumentoPendiente } from "./registrar-form";
import type { Categoria } from "../cartola/clasificar-form";
import { buscarRegla, type Regla } from "../cartola/reglas";

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const TIPOS: Record<number, string> = {
  33: "Factura electrónica",
  34: "Factura exenta",
  39: "Boleta electrónica",
  41: "Boleta exenta",
  43: "Liquidación factura",
  46: "Factura de compra",
  56: "Nota de débito",
  61: "Nota de crédito",
  110: "Factura de exportación",
  112: "Nota de crédito de exportación",
};

type DocumentoFila = {
  id: string;
  rut_emisor: string;
  razon_social: string | null;
  tipo_dte: number;
  folio: number;
  fecha_emision: string;
  monto_neto: number;
  monto_exento: number;
  iva: number;
  monto_total: number;
  signo: number;
  detalle: string | null;
  estado: string;
};

export default async function FacturasPage() {
  const supabase = await createClient();

  const [{ data: documentos }, { data: reglas }, { data: categorias }] =
    await Promise.all([
      supabase
        .from("documentos_sii")
        .select(
          "id, rut_emisor, razon_social, tipo_dte, folio, fecha_emision, monto_neto, monto_exento, iva, monto_total, signo, detalle, estado",
        )
        .order("fecha_emision", { ascending: false }),
      supabase
        .from("reglas_clasificacion")
        .select("id, patron, etiqueta, proveedor, destino, categoria_costo_id, con_iva, nota"),
      supabase
        .from("categorias_costo")
        .select("id, categoria, subcategoria")
        .order("categoria")
        .order("subcategoria"),
    ]);

  const filas = (documentos ?? []) as DocumentoFila[];
  const catalogo = (reglas ?? []) as Regla[];
  const opciones = (categorias ?? []) as Categoria[];

  const pendientes: DocumentoPendiente[] = filas
    .filter((d) => d.estado === "pendiente")
    .map((d) => ({
      id: d.id,
      fechaEmision: d.fecha_emision,
      razonSocial: d.razon_social,
      rutEmisor: d.rut_emisor,
      nombreTipo: TIPOS[d.tipo_dte] ?? `Documento tipo ${d.tipo_dte}`,
      folio: d.folio,
      montoNeto: Number(d.monto_neto) + Number(d.monto_exento),
      iva: Number(d.iva),
      montoTotal: Number(d.monto_total),
      signo: Number(d.signo),
      detalle: d.detalle,
      // El RUT del emisor es el mismo patrón que usa la cartola, así que una
      // regla aprendida en un importador sirve en el otro.
      regla: buscarRegla(
        { rut: d.rut_emisor.replace(/[.\-]/g, "").toLowerCase(), glosa: d.razon_social ?? "" },
        catalogo,
      ),
    }));

  const conRegla = pendientes.filter((d) => d.regla !== null).length;
  const registrados = filas.filter((d) => d.estado === "registrado").length;
  const totalPendiente = pendientes.reduce((a, d) => a + d.signo * d.montoTotal, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facturas de compra</h1>
        <p className="text-sm text-gray-500">
          Los XML del SII traen el RUT, el neto y el IVA exactos. Registrar la
          factura es lo que carga el gasto al mes en que se emitió.
        </p>
      </div>

      <FacturasUploadForm />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tarjeta label="Por registrar" valor={String(pendientes.length)} />
        <Tarjeta label="Monto pendiente" valor={money.format(totalPendiente)} />
        <Tarjeta label="Con regla conocida" valor={`${conRegla} de ${pendientes.length}`} />
        <Tarjeta label="Ya registrados" valor={String(registrados)} />
      </div>

      <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
        La factura es el gasto y el cargo del banco es su pago: son lo mismo. Al
        registrar una factura acá, el cargo equivalente queda marcado en Cartola
        para que no lo registres dos veces.
      </p>

      <div className="rounded-lg border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
          Documentos por registrar
        </h2>
        {pendientes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No hay documentos pendientes. Sube los XML que te llegaron al correo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Emisión</th>
                  <th className="px-3 py-2">Emisor</th>
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2">Propuesta</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {pendientes.map((d) => (
                  <RegistrarForm key={d.id} documento={d} categorias={opciones} />
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
