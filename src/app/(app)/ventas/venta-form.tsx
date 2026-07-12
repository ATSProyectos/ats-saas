"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveVenta, type ActionResult } from "./actions";

const initialState: ActionResult = {};

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

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
  valor_pluma_hora?: number;
  cantidad_horas?: number;
  valor_flete?: number;
  rigger?: number;
  extras?: number;
  variable_operador?: number;
  salida_caja?: number;
  viaticos_extras?: number;
  comision_venta?: number;
  pago_terceros?: number;
  pago_iva_terceros?: number;
  // Solo lectura (los alimentan los módulos Combustible y Peajes).
  costos_petroleo_tct?: number;
  costos_petroleo_sin_tct?: number;
  tag_peajes?: number;
  n_cotizacion?: string;
  n_factura?: string;
  fecha_facturacion?: string;
  fecha_pago?: string;
};

// Campos numéricos que participan en los cálculos en vivo.
const NUM_KEYS = [
  "valor_pluma_hora",
  "cantidad_horas",
  "valor_flete",
  "rigger",
  "extras",
  "variable_operador",
  "salida_caja",
  "viaticos_extras",
  "comision_venta",
  "pago_terceros",
  "pago_iva_terceros",
] as const;

type NumKey = (typeof NUM_KEYS)[number];
type Nums = Record<NumKey, number>;

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

  const [nums, setNums] = useState<Nums>(() => {
    const base = {} as Nums;
    for (const k of NUM_KEYS) base[k] = initialValues?.[k] ?? 0;
    return base;
  });

  function setNum(key: NumKey, value: number) {
    setNums((prev) => ({ ...prev, [key]: value }));
  }

  // Valores de solo lectura, gestionados por los módulos Combustible y Peajes.
  const petroleoTct = initialValues?.costos_petroleo_tct ?? 0;
  const petroleoSinTct = initialValues?.costos_petroleo_sin_tct ?? 0;
  const tagPeajes = initialValues?.tag_peajes ?? 0;

  // Cálculos en vivo (los definitivos los recalcula la base de datos).
  const ingresoNeto =
    nums.valor_pluma_hora * nums.cantidad_horas +
    nums.valor_flete +
    nums.rigger +
    nums.extras;
  const iva = Math.round(ingresoNeto * 0.19);
  const total = ingresoNeto + iva;
  const costosDirectos =
    nums.variable_operador +
    nums.salida_caja +
    nums.viaticos_extras +
    nums.comision_venta +
    nums.pago_terceros +
    nums.pago_iva_terceros +
    petroleoTct +
    petroleoSinTct +
    tagPeajes;
  const margen = ingresoNeto - costosDirectos;

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <NumberField name="valor_pluma_hora" label="Valor pluma ($/h)" value={nums.valor_pluma_hora} onChange={setNum} />
          <NumberField name="cantidad_horas" label="Horas pluma" value={nums.cantidad_horas} onChange={setNum} step="0.5" />
          <NumberField name="valor_flete" label="Valor flete ($)" value={nums.valor_flete} onChange={setNum} />
          <NumberField name="rigger" label="Rigger ($)" value={nums.rigger} onChange={setNum} />
          <NumberField name="extras" label="Extras ($)" value={nums.extras} onChange={setNum} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-gray-50 p-3 text-sm sm:grid-cols-4">
          <Calc label="Monto neto" value={money.format(ingresoNeto)} />
          <Calc label="IVA (19%)" value={money.format(iva)} />
          <Calc label="Total" value={money.format(total)} strong />
          <Calc
            label="Margen bruto"
            value={money.format(margen)}
            tone={margen >= 0 ? "good" : "bad"}
          />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Costos directos del servicio
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberField name="variable_operador" label="Variable operador" value={nums.variable_operador} onChange={setNum} />
          <NumberField name="salida_caja" label="Salida de caja" value={nums.salida_caja} onChange={setNum} />
          <NumberField name="viaticos_extras" label="Viáticos / extras" value={nums.viaticos_extras} onChange={setNum} />
          <NumberField name="comision_venta" label="Comisión de venta" value={nums.comision_venta} onChange={setNum} />
          <NumberField name="pago_terceros" label="Pago a terceros" value={nums.pago_terceros} onChange={setNum} />
          <NumberField name="pago_iva_terceros" label="IVA a terceros" value={nums.pago_iva_terceros} onChange={setNum} />
          <ReadOnlyMoney label="Petróleo TCT" value={petroleoTct} hint="Desde módulo Combustible" />
          <ReadOnlyMoney label="Petróleo sin TCT" value={petroleoSinTct} hint="Desde módulo Combustible" />
          <ReadOnlyMoney label="TAG / peajes" value={tagPeajes} hint="Desde módulo Peajes" />
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

function NumberField({
  name,
  label,
  value,
  onChange,
  step = "1",
  hint,
}: {
  name: NumKey;
  label: string;
  value: number;
  onChange: (key: NumKey, value: number) => void;
  step?: string;
  hint?: string;
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
        step={step}
        value={value}
        onChange={(e) => onChange(name, Number(e.target.value) || 0)}
        onFocus={(e) => e.target.select()}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
      />
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

function ReadOnlyMoney({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      <div className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm tabular-nums text-gray-700">
        {money.format(value)}
      </div>
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Calc({
  label,
  value,
  strong,
  tone = "neutral",
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "neutral" | "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-[#006300]"
      : tone === "bad"
        ? "text-[#d03b3b]"
        : "text-gray-900";
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`tabular-nums ${strong ? "text-base font-semibold" : "font-medium"} ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}
