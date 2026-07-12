"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clienteSchema } from "@/lib/validations/cliente";

export type ActionResult = { error?: string; success?: boolean };

export async function createCliente(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = clienteSchema.safeParse({ nombre: formData.get("nombre") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").insert(parsed.data);

  if (error) {
    return {
      error: error.code === "23505" ? "Ese cliente ya existe." : error.message,
    };
  }

  revalidatePath("/clientes");
  return { success: true };
}

export async function updateCliente(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = clienteSchema.safeParse({ nombre: formData.get("nombre") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    return {
      error: error.code === "23505" ? "Ese cliente ya existe." : error.message,
    };
  }

  revalidatePath("/clientes");
  return { success: true };
}
