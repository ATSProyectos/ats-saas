import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteEditForm } from "./cliente-edit-form";

export default async function ClienteEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("id", id)
    .single();

  if (!cliente) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Editar cliente</h1>
      <ClienteEditForm id={cliente.id} nombre={cliente.nombre} />
    </div>
  );
}
