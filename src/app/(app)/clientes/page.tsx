import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClienteCreateForm } from "./cliente-create-form";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: clientes, error } = await supabase
    .from("clientes")
    .select("id, nombre, created_at")
    .order("nombre");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <p className="text-sm text-gray-500">
          Catálogo de clientes de ATS Ingeniería y Proyectos.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <ClienteCreateForm />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Registrado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-red-600">
                  Error al cargar clientes: {error.message}
                </td>
              </tr>
            )}
            {clientes?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-gray-400">
                  Aún no hay clientes registrados.
                </td>
              </tr>
            )}
            {clientes?.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">{c.nombre}</td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(c.created_at).toLocaleDateString("es-CL")}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/clientes/${c.id}`}
                    className="text-gray-500 hover:text-black"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
