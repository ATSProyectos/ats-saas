"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ventaSchema } from "@/lib/validations/venta";

export type ActionResult = { error?: string };

async function resolveOperadorId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nombre: string | undefined,
): Promise<string | null> {
  if (!nombre) return null;

  const { data: existing } = await supabase
    .from("operadores")
    .select("id")
    .eq("nombre", nombre)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("operadores")
    .insert({ nombre })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id;
}

export async function saveVenta(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ventaSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { operador_nombre, ...values } = parsed.data;

  let operadorId: string | null;
  try {
    operadorId = await resolveOperadorId(supabase, operador_nombre);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar el operador." };
  }

  const id = formData.get("id");
  const payload = {
    ...values,
    fecha_facturacion: values.fecha_facturacion || null,
    fecha_pago: values.fecha_pago || null,
    operador_id: operadorId,
  };

  if (typeof id === "string" && id) {
    const { error } = await supabase
      .from("ventas_servicios")
      .update(payload)
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("ventas_servicios")
      .insert({ ...payload, created_by: user?.id });
    if (error) return { error: error.message };
  }

  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  redirect("/ventas");
}
