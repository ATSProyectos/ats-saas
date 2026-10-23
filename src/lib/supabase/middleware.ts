import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas accesibles sin sesión completa (aal2).
//
// "/auth/confirm" y "/actualizar-clave" son el flujo de recuperación de
// contraseña: quien llega ahí todavía no superó el segundo factor. Abrirlas
// no debilita el MFA porque Supabase exige aal2 para aceptar el cambio de
// contraseña de una cuenta con factor enrolado, y el propio formulario pide
// el código TOTP antes de mostrar los campos.
const PUBLIC_PATHS = ["/login", "/auth/confirm", "/actualizar-clave"];

/**
 * Refresca la sesión de Supabase en cada request y bloquea el acceso a
 * rutas privadas si no hay sesión válida. Debe correr en TODAS las rutas
 * (ver matcher en middleware.ts) porque los Server Components no pueden
 * escribir cookies por sí mismos.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Un usuario con solo contraseña (aal1) que aún debe completar el
  // segundo factor (nextLevel aal2) NO cuenta como autenticado para
  // rutas privadas: sin esto, el MFA sería solo cosmético.
  let fullyAuthenticated = false;
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    fullyAuthenticated = !aal || aal.currentLevel === aal.nextLevel;
  }

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!fullyAuthenticated && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (fullyAuthenticated && request.nextUrl.pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/dashboard";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
