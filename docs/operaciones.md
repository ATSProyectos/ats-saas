# Operación y accesos — ATS SAAS

Notas de operación del sistema. No contiene claves ni secretos: solo
procedimientos y dónde vive cada cosa.

## Mapa de servicios

| Servicio | Para qué | Cómo se entra |
|---|---|---|
| **Vercel** | Hosting de la app (`ats-saas-mu.vercel.app`) | Sin contraseña: código de 6 dígitos al correo, o cuenta de GitHub |
| **Supabase** | Base de datos y autenticación | Correo + contraseña |
| **GitHub** | Repositorio `ATSProyectos/ats-saas` | Cuenta GitHub |
| **La app** | El sistema de gestión | Correo + contraseña + código TOTP |

Los tres primeros son independientes entre sí. Un fallo de login en la app
**no** tiene relación con Vercel ni con GitHub, aunque el dominio sea
`.vercel.app`.

## MFA de la app

El segundo factor es **TOTP**: el código no llega por SMS ni correo, lo
genera la app autenticadora sin conexión.

> **App en uso: Google Authenticator.**

La entrada aparece con el identificador del proyecto Supabase, **no** con el
nombre "ATS", porque el enrolamiento no define `issuer` ni `friendlyName`
(ver `src/components/auth/login-form.tsx`).

Si el código sale inválido, revisar primero la hora automática del teléfono:
el TOTP depende del reloj.

### Reenrolar el segundo factor

Cuando se pierde el acceso a la app autenticadora. En Supabase → SQL Editor:

```sql
delete from auth.mfa_factors
where user_id = (select id from auth.users where email = 'tu@correo.cl');
```

En el siguiente login la app detecta que no hay factor y muestra un QR nuevo
para escanear (paso `enroll`). Conviene guardarlo también en un gestor de
contraseñas, no solo en el teléfono.

## Usuarios y roles

Todo usuario nuevo nace con rol `lector` (trigger `handle_new_user()` en
`supabase/migrations/0001_schema.sql`), que solo permite mirar. Para dar
acceso de escritura:

```sql
update public.profiles
set role = 'admin', full_name = 'Nombre Apellido'
where id = (select id from auth.users where email = 'tu@correo.cl');
```

Roles disponibles: `admin`, `operador`, `lector`.

Para crear un usuario a mano: Authentication → Users → Add user, marcando
**Auto Confirm User** (sin confirmar, no puede entrar).

## El proyecto Supabase se pausa solo

En plan Free, el proyecto **se pausa tras ~7 días sin actividad**. Estando
pausado la API queda apagada y la app no puede autenticar a nadie.

Síntoma engañoso: el login muestra "Correo o contraseña incorrectos" aunque
la contraseña sea correcta, porque el formulario traduce cualquier fallo a
ese mismo mensaje.

Para reactivarlo: Supabase → el proyecto → **Restore project** (tarda entre 2
y 10 minutos). La URL y las API keys no cambian, así que no hay que tocar
Vercel.

> **Plazo:** un proyecto pausado se restaura con un clic solo durante **90
> días**. Pasado ese plazo Supabase libera la infraestructura y hay que
> migrar a un proyecto nuevo, con otra URL y reconfigurando Vercel.

Si el sistema entra en operación real, conviene pasar a plan Pro.

## Recuperación de contraseña

El flujo vive en `/login` → "¿Olvidaste tu contraseña?" → correo con enlace →
`/auth/confirm` → `/actualizar-clave`.

Supabase exige `aal2` para cambiar la contraseña de una cuenta con MFA
activo, y el enlace de recuperación solo entrega `aal1`. Por eso el
formulario pide el código TOTP **antes** de mostrar los campos de contraseña.
No es un paso opcional: sin él, Supabase responde 401.

Configuración necesaria en Supabase (Authentication → URL Configuration):

- Site URL: `https://ats-saas-mu.vercel.app`
- Redirect URLs: `https://ats-saas-mu.vercel.app/**`

Opcional pero recomendado, en Authentication → Emails → *Reset Password*:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">
  Definir nueva contraseña
</a>
```

Con la plantilla por defecto (PKCE) el enlace **debe abrirse en el mismo
navegador** que pidió el cambio. Con `{{ .TokenHash }}` funciona entre
dispositivos.

## Variables de entorno

En Vercel (Settings → Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Ambas son públicas por diseño: lo que protege los datos es RLS en la base,
no ocultar la clave. Para desarrollo local van en `.env.local`, que está en
`.gitignore`.
