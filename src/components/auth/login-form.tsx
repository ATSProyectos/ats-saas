"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "password" | "enroll" | "challenge";

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Datos del enrolamiento MFA en curso.
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  // Si la página se recarga a mitad del flujo MFA (sesión aal1 ya activa),
  // retoma el paso correcto en vez de pedir la contraseña de nuevo.
  useEffect(() => {
    async function resumeExistingSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) await goToNextStepAfterAuth();
    }
    resumeExistingSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goToNextStepAfterAuth() {
    const { data, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      setError(aalError.message);
      return;
    }

    if (data.currentLevel === "aal2") {
      router.replace("/dashboard");
      return;
    }

    if (data.nextLevel === "aal2" && data.currentLevel === "aal1") {
      // Ya tiene un factor MFA registrado: pedir el código.
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError(factorsError.message);
        return;
      }
      const totp = factors.totp[0];
      if (!totp) {
        setError("No se encontró el factor MFA. Contacta al administrador.");
        return;
      }
      setFactorId(totp.id);
      setStep("challenge");
      return;
    }

    // Sin factor MFA registrado todavía: obligar a enrolarse.
    const { data: enrollData, error: enrollError } =
      await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (enrollError) {
      setError(enrollError.message);
      return;
    }
    setFactorId(enrollData.id);
    setQrCode(enrollData.totp.qr_code);
    setSecret(enrollData.totp.secret);
    setStep("enroll");
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    await goToNextStepAfterAuth();
    setLoading(false);
  }

  async function handleEnrollVerify(e: FormEvent) {
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
      setError("Código incorrecto. Verifica la hora de tu teléfono e intenta de nuevo.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
  }

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

    router.replace("/dashboard");
  }

  if (step === "enroll") {
    return (
      <form onSubmit={handleEnrollVerify} className="flex flex-col gap-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Activa la verificación en dos pasos</h2>
          <p className="mt-1 text-sm text-gray-500">
            Escanea este código con Google Authenticator, Authy u otra app
            similar.
          </p>
        </div>
        {qrCode && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrCode}
            alt="Código QR para configurar MFA"
            className="mx-auto h-48 w-48"
          />
        )}
        {secret && (
          <p className="text-center text-xs text-gray-400">
            Código manual: <span className="font-mono">{secret}</span>
          </p>
        )}
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Código de 6 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-widest"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Verificando..." : "Confirmar y activar"}
        </button>
      </form>
    );
  }

  if (step === "challenge") {
    return (
      <form onSubmit={handleChallengeVerify} className="flex flex-col gap-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Verificación en dos pasos</h2>
          <p className="mt-1 text-sm text-gray-500">
            Ingresa el código de tu app autenticadora.
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
          {loading ? "Verificando..." : "Ingresar"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Correo
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
