import { UpdatePasswordForm } from "@/components/auth/update-password-form";

// Depende de la sesión de recuperación del navegador: nunca debe quedar
// cacheada estáticamente entre distintos usuarios.
export const dynamic = "force-dynamic";

export default function ActualizarClavePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            ATS Ingeniería y Proyectos
          </h1>
          <p className="text-sm text-gray-500">Definir nueva contraseña</p>
        </div>
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
