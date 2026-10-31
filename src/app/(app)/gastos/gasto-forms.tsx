"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveGastoAdministrativo, saveGastoOperacional } from "./actions";

export type CategoriaEerr = {
  id: string;
  categoria: string;
  subcategoria: string;
  linea_codigo: string;
  linea_nombre: string;
  linea_grupo: string;
  nota_mapeo: string | null;
};

const initialState: { error?: string; success?: boolean } = {};

const MEDIOS_PAGO = [
  "Transferencia",
  "Efectivo",
  "Tarjeta de crédito",
  "Tarjeta de débito",
  "Cheque",
  "Crédito proveedor",
];

const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

/**
 * Selector de categoría que muestra en qué línea del estado de resultados va a
 * quedar el gasto, y avisa cuando la categoría está fuera del resultado (un
 * costo que ya entra por otro módulo, el pago de IVA o una compra de activo).
 */
function CategoriaSelect({
  categorias,
  id,
}: {
  categorias: CategoriaEerr[];
  id: string;
}) {
  const [seleccionada, setSeleccionada] = useState("");
  const elegida = categorias.find((c) => c.id === seleccionada);

  const porCategoria = categorias.reduce<Record<string, CategoriaEerr[]>>(
    (acc, c) => {
      (acc[c.categoria] ??= []).push(c);
      return acc;
    },
    {},
  );

  return (
    <div className="col-span-2">
      <label htmlFor={id} className={labelClass}>
        Categoría de costo *
      </label>
      <select
        id={id}
        name="categoria_costo_id"
        required
        value={seleccionada}
        onChange={(e) => setSeleccionada(e.target.value)}
        className={inputClass}
      >
        <option value="">Selecciona una categoría</option>
        {Object.keys(porCategoria)
          .sort()
          .map((categoria) => (
            <optgroup key={categoria} label={categoria}>
              {porCategoria[categoria].map((c) => (
                <option key={c.id} value={c.id}>
                  {c.subcategoria} → {c.linea_codigo}
                </option>
              ))}
            </optgroup>
          ))}
      </select>
      {elegida && (
        <p
          className={`mt-1 text-xs ${
            elegida.linea_grupo === "excluido" ||
            elegida.linea_grupo === "sin_clasificar"
              ? "text-amber-700"
              : "text-gray-500"
          }`}
        >
          Va a la línea {elegida.linea_codigo} · {elegida.linea_nombre}
          {elegida.nota_mapeo ? ` (${elegida.nota_mapeo})` : ""}
        </p>
      )}
    </div>
  );
}

function MontoFields({ prefijo }: { prefijo: string }) {
  return (
    <>
      <div>
        <label htmlFor={`${prefijo}_monto_neto`} className={labelClass}>
          Monto neto ($) *
        </label>
        <input
          id={`${prefijo}_monto_neto`}
          name="monto_neto"
          type="number"
          min={0}
          step="1"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`${prefijo}_iva`} className={labelClass}>
          IVA ($)
        </label>
        <input
          id={`${prefijo}_iva`}
          name="iva"
          type="number"
          min={0}
          step="1"
          placeholder="19% automático"
          className={inputClass}
        />
      </div>
    </>
  );
}

function PagoFields({ prefijo }: { prefijo: string }) {
  return (
    <>
      <div>
        <label htmlFor={`${prefijo}_medio_pago`} className={labelClass}>
          Medio de pago
        </label>
        <select
          id={`${prefijo}_medio_pago`}
          name="medio_pago"
          className={inputClass}
          defaultValue=""
        >
          <option value="">—</option>
          {MEDIOS_PAGO.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${prefijo}_facturado_ats`} className={labelClass}>
          Factura a nombre de ATS
        </label>
        <select
          id={`${prefijo}_facturado_ats`}
          name="facturado_ats"
          className={inputClass}
          defaultValue=""
        >
          <option value="">—</option>
          <option value="Sí">Sí</option>
          <option value="No">No</option>
        </select>
      </div>
      <div>
        <label htmlFor={`${prefijo}_tipo_costo`} className={labelClass}>
          Tipo de costo
        </label>
        <select
          id={`${prefijo}_tipo_costo`}
          name="tipo_costo"
          className={inputClass}
          defaultValue=""
        >
          <option value="">—</option>
          <option value="Fijo">Fijo</option>
          <option value="Variable">Variable</option>
        </select>
      </div>
    </>
  );
}

export function GastoOperacionalForm({
  categorias,
}: {
  categorias: CategoriaEerr[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveGastoOperacional,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <details
      open
      className="rounded-lg border border-gray-200 bg-white p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold text-gray-700">
        Nuevo gasto operacional (flota, equipos y operación)
      </summary>
      <form
        ref={formRef}
        action={formAction}
        className="mt-3 grid grid-cols-2 items-start gap-3 sm:grid-cols-4"
      >
        <div>
          <label htmlFor="op_fecha" className={labelClass}>
            Fecha *
          </label>
          <input
            id="op_fecha"
            name="fecha"
            type="date"
            required
            className={inputClass}
          />
        </div>
        <CategoriaSelect categorias={categorias} id="op_categoria" />
        <div>
          <label htmlFor="op_proveedor" className={labelClass}>
            Proveedor
          </label>
          <input id="op_proveedor" name="proveedor" className={inputClass} />
        </div>
        <MontoFields prefijo="op" />
        <div>
          <label htmlFor="op_n_factura" className={labelClass}>
            N° factura
          </label>
          <input id="op_n_factura" name="n_factura" className={inputClass} />
        </div>
        <PagoFields prefijo="op" />
        <div className="col-span-2 sm:col-span-4">
          <label htmlFor="op_descripcion" className={labelClass}>
            Descripción
          </label>
          <input
            id="op_descripcion"
            name="descripcion"
            className={inputClass}
          />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar gasto operacional"}
          </button>
          {state.error && (
            <span className="ml-2 text-sm text-red-600">{state.error}</span>
          )}
        </div>
      </form>
    </details>
  );
}

export function GastoAdministrativoForm({
  categorias,
}: {
  categorias: CategoriaEerr[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveGastoAdministrativo,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <details className="rounded-lg border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-gray-700">
        Nuevo gasto de administración y ventas
      </summary>
      <form
        ref={formRef}
        action={formAction}
        className="mt-3 grid grid-cols-2 items-start gap-3 sm:grid-cols-4"
      >
        <div>
          <label htmlFor="ad_fecha" className={labelClass}>
            Fecha *
          </label>
          <input
            id="ad_fecha"
            name="fecha"
            type="date"
            required
            className={inputClass}
          />
        </div>
        <CategoriaSelect categorias={categorias} id="ad_categoria" />
        <div>
          <label htmlFor="ad_descripcion" className={labelClass}>
            Descripción
          </label>
          <input
            id="ad_descripcion"
            name="descripcion"
            className={inputClass}
          />
        </div>
        <MontoFields prefijo="ad" />
        <PagoFields prefijo="ad" />
        <div className="col-span-2 sm:col-span-4">
          <label htmlFor="ad_observaciones" className={labelClass}>
            Observaciones
          </label>
          <input
            id="ad_observaciones"
            name="observaciones"
            className={inputClass}
          />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar gasto administrativo"}
          </button>
          {state.error && (
            <span className="ml-2 text-sm text-red-600">{state.error}</span>
          )}
        </div>
      </form>
    </details>
  );
}
