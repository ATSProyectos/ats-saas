import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VentaForm } from "../venta-form";

export default async function NuevaVentaPage() {
  const supabase = await createClient();

  const [{ data: clientes }, { data: operadores }] = await Promise.all([
    supabase.from("clientes").select("id, nombre").order("nombre"),
    supabase.from("operadores").select("nombre").order("nombre"),
  ]);

  if (!clientes || clientes.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nuevo servicio vendido
        </h1>
        <p className="text-sm text-gray-600">
          Primero debes registrar al menos un cliente.{" "}
          <Link href="/clientes" className="underline">
            Ir a Clientes
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Nuevo servicio vendido
      </h1>
      <VentaForm
        clientes={clientes}
        operadoresSugeridos={(operadores ?? []).map((o) => o.nombre)}
      />
    </div>
  );
}
