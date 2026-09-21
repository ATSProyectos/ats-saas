"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

type Step = "verificando" | "challenge" | "password" | "expirado";

export function UpdatePasswordForm() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("verificando");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // El enlace de recuperación deja una sesión aal1. Supabase EXIGE aal2 para
  // cambiar la contraseña de una cuenta con MFA activo (devuelve 401), así que
  // si hay un factor enrolado hay que superarlo antes de mostrar el formulario.
  useEffect(() => {
    async function prepararPaso() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setStep("expirado");
        return;
      }

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) {
        setError(aalError.message);
        setStep("password");
        return;
      }

      if (aal && aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
        const { data: factors, error: factorsError } =
          await supabase.auth.mfa.listFactors();

        if (factorsError) {
          setError(factorsError.message);
          setStep("expirado");
          return;
        }

        const totp = factors.totp[0];
        if (!totp) {
          setError("No se encontró el factor MFA. Contacta al administrador.");
          setStep("expirado");
          return;
        }

        setFactorId(totp.id);
        setStep("challenge");
        return;
      }

      setStep("password");
    }

    prepararPaso();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChallengeVerify(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setError(challengeError.message);
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError("Código incorrecto. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    setCode("");
    setStep("password");
    setLoading(false);
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Con la sesión ya en aal2 (o sin MFA pendiente) el middleware deja pasar
    // directo al dashboard, sin obligar a iniciar sesión otra vez.
    router.replace("/dashboard");
  }

  if (step === "verificando") {
    return (
      <p className="text-center text-sm text-gray-500">Verificando el enlace...</p>
    );
  }

  if (step === "expirado") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-gray-600">
          {error ??
            "El enlace no es válido o ya expiró. Solicita uno nuevo desde la página de inicio de sesión."}
        </p>
        <Link
          href="/login"
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  if (step === "challenge") {
    return (
      <form onSubmit={handleChallengeVerify} className="flex flex-col gap-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Verificación en dos pasos</h2>
          <p className="mt-1 text-sm text-gray-500">
            Por seguridad, confirma tu identidad con el código de tu app
            autenticadora antes de cambiar la contraseña.
          </p>
        </div>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Código de 6 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoFocus
          className="rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-widest"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Verificando..." : "Continuar"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Nueva contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-gray-400">
          Mínimo {MIN_PASSWORD_LENGTH} caracteres.
        </p>
      </div>
      <div>
        <label htmlFor="confirmacion" className="mb-1 block text-sm font-medium">
          Repetir contraseña
        </label>
        <input
          id="confirmacion"
          type="password"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}
