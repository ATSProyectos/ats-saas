"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveVenta, type ActionResult } from "./actions";

const initialState: ActionResult = {};

type Cliente = { id: string; nombre: string };

type VentaFormValues = {
  id?: string;
  fecha_servicio?: string;
  cliente_id?: string;
  operador_nombre?: string;
  proyecto_obra?: string;
  origen?: string;
  destino?: string;
  servicio_tipo?: string;
  descripcion_carga?: string;
  monto_neto?: number;
  iva?: number;
  variable_operador?: number;
  salida_caja?: number;
  viaticos_extras?: number;
  comision_venta?: number;
  pago_terceros?: number;
  pago_iva_terceros?: number;
  costos_petroleo?: number;
  tag_peajes?: number;
  n_cotizacion?: string;
  n_factura?: string;
  fecha_facturacion?: string;
  fecha_pago?: string;
};

function MoneyField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        step="1"
        defaultValue={defaultValue ?? 0}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
      />
    </div>
  );
}

export function VentaForm({
  clientes,
  operadoresSugeridos,
  initialValues,
}: {
  clientes: Cliente[];
  operadoresSugeridos: string[];
  initialValues?: VentaFormValues;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveVenta, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {initialValues?.id && (
        <input type="hidden" name="id" value={initialValues.id} />
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Datos del servicio
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="fecha_servicio" className="mb-1 block text-xs font-medium text-gray-600">
              Fecha del servicio *
            </label>
            <input
              id="fecha_servicio"
              name="fecha_servicio"
              type="date"
              required
              defaultValue={initialValues?.fecha_servicio}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="cliente_id" className="mb-1 block text-xs font-medium text-gray-600">
              Cliente *
            </label>
            <select
              id="cliente_id"
              name="cliente_id"
              required
              defaultValue={initialValues?.cliente_id ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="operador_nombre" className="mb-1 block text-xs font-medium text-gray-600">
              Operador
            </label>
            <input
              id="operador_nombre"
              name="operador_nombre"
              list="operadores-list"
              defaultValue={initialValues?.operador_nombre}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <datalist id="operadores-list">
              {operadoresSugeridos.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="servicio_tipo" className="mb-1 block text-xs font-medium text-gray-600">
              Tipo de servicio
            </label>
            <input
              id="servicio_tipo"
              name="servicio_tipo"
              placeholder="Ej: Grúa pluma, flete..."
              defaultValue={initialValues?.servicio_tipo}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="origen" className="mb-1 block text-xs font-medium text-gray-600">
              Origen
            </label>
            <input
              id="origen"
              name="origen"
              defaultValue={initialValues?.origen}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="destino" className="mb-1 block text-xs font-medium text-gray-600">
              Destino
            </label>
            <input
              id="destino"
              name="destino"
              defaultValue={initialValues?.destino}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="descripcion_carga" className="mb-1 block text-xs font-medium text-gray-600">
              Descripción / carga
            </label>
            <input
              id="descripcion_carga"
              name="descripcion_carga"
              defaultValue={initialValues?.descripcion_carga}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Ingreso</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MoneyField name="monto_neto" label="Monto neto ($) *" defaultValue={initialValues?.monto_neto} />
          <MoneyField name="iva" label="IVA ($)" defaultValue={initialValues?.iva} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Costos directos del servicio
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MoneyField name="variable_operador" label="Variable operador" defaultValue={initialValues?.variable_operador} />
          <MoneyField name="salida_caja" label="Salida de caja" defaultValue={initialValues?.salida_caja} />
          <MoneyField name="viaticos_extras" label="Viáticos / extras" defaultValue={initialValues?.viaticos_extras} />
          <MoneyField name="comision_venta" label="Comisión de venta" defaultValue={initialValues?.comision_venta} />
          <MoneyField name="pago_terceros" label="Pago a terceros" defaultValue={initialValues?.pago_terceros} />
          <MoneyField name="pago_iva_terceros" label="IVA a terceros" defaultValue={initialValues?.pago_iva_terceros} />
          <MoneyField name="costos_petroleo" label="Costos petróleo" defaultValue={initialValues?.costos_petroleo} />
          <MoneyField name="tag_peajes" label="TAG / peajes" defaultValue={initialValues?.tag_peajes} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Facturación</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="n_cotizacion" className="mb-1 block text-xs font-medium text-gray-600">
              N° Cotización
            </label>
            <input
              id="n_cotizacion"
              name="n_cotizacion"
              defaultValue={initialValues?.n_cotizacion}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="n_factura" className="mb-1 block text-xs font-medium text-gray-600">
              N° Factura
            </label>
            <input
              id="n_factura"
              name="n_factura"
              defaultValue={initialValues?.n_factura}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="fecha_facturacion" className="mb-1 block text-xs font-medium text-gray-600">
              Fecha facturación
            </label>
            <input
              id="fecha_facturacion"
              name="fecha_facturacion"
              type="date"
              defaultValue={initialValues?.fecha_facturacion}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="fecha_pago" className="mb-1 block text-xs font-medium text-gray-600">
              Fecha de pago
            </label>
            <input
              id="fecha_pago"
              name="fecha_pago"
              type="date"
              defaultValue={initialValues?.fecha_pago}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </section>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-5 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar servicio"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/ventas")}
          className="rounded-md border border-gray-300 px-5 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
