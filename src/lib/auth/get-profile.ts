import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string | null;
  role: "admin" | "operador" | "lector";
};

/**
 * Obtiene el usuario y su perfil (rol) en el servidor. Redirige a /login
 * si no hay sesión válida; la comprobación de MFA (aal2) ya la hace el
 * middleware antes de llegar aquí.
 */
export async function requireProfile(): Promise<{
  user: { id: string; email: string | undefined };
  profile: Profile;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return { user: { id: user.id, email: user.email }, profile };
}
