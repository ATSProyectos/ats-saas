import { LoginForm } from "@/components/auth/login-form";

// El login depende de la sesión del navegador (Supabase Auth) y nunca debe
// quedar cacheado estáticamente entre distintos usuarios.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // /auth/confirm redirige aquí con ?error=enlace-invalido cuando el token de
  // recuperación ya venció o fue usado.
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            ATS Ingeniería y Proyectos
          </h1>
          <p className="text-sm text-gray-500">Sistema de Gestión</p>
        </div>
        <LoginForm enlaceInvalido={error === "enlace-invalido"} />
      </div>
    </main>
  );
}
