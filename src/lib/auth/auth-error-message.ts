import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";

/**
 * Traduce un error de Supabase Auth a un mensaje accionable en español.
 *
 * Existe porque antes CUALQUIER fallo de login se mostraba como "Correo o
 * contraseña incorrectos", incluida la causa más común de caída: el proyecto
 * Supabase del plan Free se pausa solo tras ~7 días sin actividad y su API
 * deja de responder. El usuario cambiaba la contraseña una y otra vez
 * mientras el problema real era que la base estaba dormida.
 */
export function mensajeDeErrorAuth(error: AuthError): string {
  // Sin respuesta del servidor: no hay `status` porque nunca llegó a haber
  // una respuesta HTTP que leer.
  if (isAuthRetryableFetchError(error) || error.status === undefined) {
    return (
      "No se pudo conectar con el servidor. Revisa tu conexión y, si el " +
      "problema persiste, confirma en Supabase que el proyecto no esté pausado."
    );
  }

  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Tu correo todavía no está confirmado. Pide al administrador que lo confirme en Supabase.";
    case "user_banned":
      return "Tu cuenta está deshabilitada. Contacta al administrador.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos seguidos. Espera unos minutos antes de reintentar.";
    case "mfa_verification_failed":
      return "Código incorrecto. Verifica la hora automática de tu teléfono e intenta de nuevo.";
    case "mfa_challenge_expired":
      return "El código expiró. Genera uno nuevo en tu app autenticadora.";
    case "weak_password":
      return "La contraseña es demasiado débil. Combina letras, números y símbolos.";
    case "same_password":
      return "La contraseña nueva debe ser distinta de la actual.";
  }

  if (error.status >= 500) {
    return "El servidor de autenticación no está respondiendo. Inténtalo de nuevo en unos minutos.";
  }

  return error.message;
}
