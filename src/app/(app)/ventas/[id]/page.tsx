import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VentaForm } from "../venta-form";

export default async function EditarVentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: venta }, { data: clientes }, { data: operadores }] =
    await Promise.all([
      supabase
        .from("ventas_servicios")
        .select("*, operadores(nombre)")
        .eq("id", id)
        .single(),
      supabase.from("clientes").select("id, nombre").order("nombre"),
      supabase.from("operadores").select("nombre").order("nombre"),
    ]);

  if (!venta) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Editar servicio vendido
      </h1>
      <VentaForm
        clientes={clientes ?? []}
        operadoresSugeridos={(operadores ?? []).map((o) => o.nombre)}
        initialValues={{
          id: venta.id,
          fecha_servicio: venta.fecha_servicio,
          cliente_id: venta.cliente_id,
          operador_nombre: venta.operadores?.nombre ?? undefined,
          proyecto_obra: venta.proyecto_obra ?? undefined,
          origen: venta.origen ?? undefined,
          destino: venta.destino ?? undefined,
          servicio_tipo: venta.servicio_tipo ?? undefined,
          descripcion_carga: venta.descripcion_carga ?? undefined,
          valor_pluma_hora: venta.valor_pluma_hora ?? 0,
          cantidad_horas: venta.cantidad_horas ?? 0,
          valor_flete: venta.valor_flete ?? 0,
          rigger: venta.rigger ?? 0,
          extras: venta.extras ?? 0,
          variable_operador: venta.variable_operador,
          salida_caja: venta.salida_caja,
          viaticos_extras: venta.viaticos_extras,
          comision_venta: venta.comision_venta,
          pago_terceros: venta.pago_terceros,
          pago_iva_terceros: venta.pago_iva_terceros,
          costos_petroleo_tct: venta.costos_petroleo_tct,
          costos_petroleo_sin_tct: venta.costos_petroleo_sin_tct,
          tag_peajes: venta.tag_peajes,
          n_cotizacion: venta.n_cotizacion ?? undefined,
          n_factura: venta.n_factura ?? undefined,
          fecha_facturacion: venta.fecha_facturacion ?? undefined,
          fecha_pago: venta.fecha_pago ?? undefined,
        }}
      />
    </div>
  );
}
