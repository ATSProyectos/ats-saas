import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Punto de aterrizaje de los enlaces enviados por correo (recuperación de
 * contraseña). Acepta los dos formatos que puede emitir Supabase:
 *
 *  - `token_hash` + `type`: plantilla con `{{ .TokenHash }}`. Funciona aunque
 *    el correo se abra en otro navegador o dispositivo.
 *  - `code`: plantilla por defecto (`{{ .ConfirmationURL }}`) con flujo PKCE.
 *    Exige abrir el enlace en el MISMO navegador que pidió el cambio, porque
 *    el `code_verifier` vive en una cookie de ese navegador.
 *
 * Verificar el token deja una sesión (aal1) en cookies; el cambio de clave
 * propiamente tal ocurre en /actualizar-clave.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  let verificado = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    verificado = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verificado = !error;
  }

  // Redirigimos siempre a una URL limpia: el token no debe quedar en el
  // historial del navegador ni en el Referer de peticiones posteriores.
  const destino = request.nextUrl.clone();
  destino.search = "";

  if (!verificado) {
    destino.pathname = "/login";
    destino.searchParams.set("error", "enlace-invalido");
    return NextResponse.redirect(destino);
  }

  destino.pathname = "/actualizar-clave";
  return NextResponse.redirect(destino);
}
