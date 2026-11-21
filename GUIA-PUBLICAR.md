# Guía: publicar CajaCurso gratis (GitHub + Supabase + Vercel)

Todo se hace desde el navegador. No necesitas instalar nada.

**Tiempo estimado:** 30–40 minutos.
**Cuentas que necesitas (gratis):** GitHub, Supabase y Vercel (entra a Vercel con "Continue with GitHub").

---

## Paso 1 · Subir el código a GitHub
**Opción fácil:** crea un repositorio **privado y vacío** en github.com/new (nombre sugerido: `cajacurso`, sin README) y pídele a Claude que suba el proyecto ahí.

**Opción manual:** descomprime `cajacurso-proyecto.zip`. En tu repositorio nuevo elige *uploading an existing file* y arrastra el contenido. GitHub acepta ~100 archivos por carga, así que hazlo en 3 tandas (por ejemplo: `app`, luego `components` + `lib`, luego el resto). Asegúrate de subir también las carpetas ocultas `.github`.
*Nunca subas un archivo `.env`.*

## Paso 2 · Crear la base de datos en Supabase
1. En supabase.com → **New project**. Pon un nombre, una **contraseña de base de datos** (usa solo letras y números y guárdala) y la región **South America (São Paulo)**. Espera 1–2 minutos.
2. Menú izquierdo → **SQL Editor** → **New query**. Abre el archivo `supabase-setup.sql`, copia **todo** su contenido, pégalo y pulsa **Run**. Debe decir *Success*.
3. Comprueba: en **Table Editor** deben aparecer 10 tablas, y en **Storage** un bucket llamado `boletas`.
4. Junta tres datos (los usarás en el Paso 3):
   - **DATABASE_URL:** botón **Connect** (arriba) → pestaña *Transaction pooler* → copia la cadena (puerto **6543**) y reemplaza `[YOUR-PASSWORD]` por tu contraseña.
   - **SUPABASE_URL:** *Project Settings → API* → "Project URL".
   - **SUPABASE_SERVICE_KEY:** *Project Settings → API Keys* → la clave **secret** (o `service_role`). **Es secreta: no la compartas ni la subas a GitHub.**

## Paso 3 · Publicar en Vercel
1. vercel.com → **Add New… → Project** → elige tu repositorio `cajacurso` → **Import**. Vercel detecta Next.js solo.
2. Antes de pulsar Deploy, abre **Environment Variables** y agrega:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | la cadena del Paso 2 (puerto 6543) |
| `AUTH_SECRET` | 40+ letras y números al azar (usa el "sugerir contraseña" del navegador) |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | clave secret |
| `SUPABASE_BUCKET` | `boletas` |
| `ADMIN_EMAILS` | **tu correo** de administrador (varios: separados por coma) |
| `TRANSFER_INFO` | datos para transferir. Ej: `Banco Estado\nCuenta Vista 123456789\nRUT 11.111.111-1\nCorreo pagos@tudominio.cl` (`\n` = salto de línea) |
| `CRON_SECRET` | otro texto al azar (activa el recordatorio diario y mantiene activa la base) |
| `APP_URL` | por ahora `https://cajacurso.vercel.app` (se corrige abajo) |

3. Pulsa **Deploy**. Al terminar, Vercel te muestra tu dirección (por ejemplo `https://cajacurso-abc.vercel.app`).
4. Ve a *Settings → Environment Variables*, cambia `APP_URL` por tu dirección real y haz **Redeploy** (pestaña Deployments → ⋯ → Redeploy). Esto hace que los enlaces, QR y correos apunten bien.

## Paso 4 · Primer uso (importante)
1. Abre tu dirección y **regístrate primero con el correo que pusiste en `ADMIN_EMAILS`**. Hazlo antes de compartir el enlace con nadie: quien se registre primero con ese correo queda como administrador.
2. Arriba aparecerá el botón **🛡️ Administración**.
3. Crea un curso de prueba, agrega alumnos, registra pagos y revisa los QR en *Accesos y QR*.

---

## Cómo controlas los planes (panel de administración)
En **🛡️ Administración** puedes:
- **Solicitudes:** cuando un tesorero elige *transferencia* y pulsa "Ya transferí", te llega aquí (y por correo si configuras SMTP). Revisas tu banco y pulsas **Aprobar y activar**: el Pro queda activo y puedes anotar el monto real.
- **Cursos y planes:** busca un curso por colegio, curso, código o correo y **suma días de Pro** (30, 90, 365 días…), **fija una fecha exacta**, **quita el Pro** o permite otra prueba gratuita. Sirve para cortesías, casos especiales o pagos en efectivo.
- **Historial de pagos:** todo movimiento (prueba, Mercado Pago, transferencia, manual) con fecha, monto y nota.
- **Resumen:** usuarios, cursos, cursos con Pro e ingresos.

Opciones de pago que ve el tesorero en *Plan e integraciones*: **Mercado Pago** (automático, cuando lo configures) o **transferencia** (con tu aprobación). Siempre puedes activar a mano.

---

## Botón "Conectar con Mercado Pago" (para que cada tesorero cobre a sus apoderados)
Mercado Pago se usa en **dos cosas distintas**:
1. **Cobrar el Plan Pro a los tesoreros** → el dinero llega a **tu** cuenta (variable `MP_PLATFORM_ACCESS_TOKEN`). Es opcional: también puedes cobrar por transferencia y activar tú desde `/admin`.
2. **Que los apoderados paguen la cuota desde su ficha** → el dinero llega a la cuenta de Mercado Pago **del tesorero** de cada curso (función Pro). Con el botón, el tesorero solo inicia sesión en Mercado Pago y autoriza; no copia claves.

Para activar el botón (una sola vez, lo haces tú como administrador):
1. En **mercadopago.cl/developers → Tus integraciones**, crea una aplicación (o usa la que ya tengas) y en su configuración agrega la **URL de redireccionamiento (Redirect URL)**: `https://TU-SITIO.vercel.app/api/integrations/mp/callback` (exactamente igual a tu `APP_URL` + esa ruta).
2. En **Credenciales → Producción** (actívalas si es la primera vez) copia el **Client ID** y el **Client Secret**.
3. En Vercel agrega `MP_CLIENT_ID` y `MP_CLIENT_SECRET` y haz **Redeploy**.
4. Listo: en *Plan e integraciones* de un curso Pro aparece **Conectar con Mercado Pago**. El permiso dura 6 meses y la plataforma lo renueva sola. Si no configuras esto, el tesorero puede igualmente pegar su Access Token.

---

## Panel de superusuario (administrador)
En **🛡️ Administración** atiendes todo lo que pasa en la plataforma:
- **Solicitudes:** lo que piden los tesoreros desde su panel (por ejemplo activar *Pago en línea (Mercado Pago)*) y los mensajes que te envían. Te llegan al panel y por correo (si hay SMTP). Al **aprobar**, la función se activa en ese curso al instante y el usuario recibe un correo; también puedes rechazar con un motivo.
- **Usuarios:** busca por nombre o correo; **edita** nombre/correo, **suspende o reactiva** la cuenta (suspendida no puede entrar), **restablece la contraseña** (te muestra una temporal una sola vez) o **elimina** al usuario con todos sus cursos (pide escribir su correo). A los administradores no se les puede suspender ni eliminar.
- **Cursos y planes:** días de Pro, fecha exacta, quitar Pro, **Funciones del curso** (activar o bloquear cada módulo/integración por curso) y **eliminar curso** (pide escribir el nombre).
- Mercado Pago es la única función que el Pro **no** incluye: solo se activa cuando tú la apruebas (o la activas en *Funciones del curso*).

---

## Activar el envío de correos (Gmail, gratis y sin dominio)
Sirve para: estado de cuenta en PDF a apoderados, recordatorios, boletas de eventos y avisos de solicitudes. Con Gmail puedes enviar a cualquier persona (límite de unos 500 correos al día).

1. **Crea o elige un Gmail para la plataforma** (recomendado uno nuevo, por ejemplo `tesoreria.cajacurso@gmail.com`; así los apoderados no ven tu correo personal).
2. En ese Gmail entra a **myaccount.google.com → Seguridad** y activa la **Verificación en 2 pasos** (si no la tienes, Google no deja crear la clave del siguiente paso).
3. Abre **myaccount.google.com/apppasswords**, escribe un nombre (por ejemplo `CajaCurso`) y pulsa **Crear**. Google te muestra una clave de **16 letras**: cópiala sin espacios. Es distinta de tu contraseña normal y se puede borrar cuando quieras.
4. En **Vercel → tu proyecto → Settings → Environment Variables** agrega:

| Variable | Valor |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | el Gmail completo (ej. `tesoreria.cajacurso@gmail.com`) |
| `SMTP_PASS` | la clave de 16 letras del paso 3 |
| `SMTP_FROM` | `CajaCurso <tesoreria.cajacurso@gmail.com>` |

5. **Deployments → ⋯ → Redeploy** (sin Redeploy no toma las variables nuevas).
6. Prueba: en **Alumnos**, deja a un alumno con **tu propio correo** como apoderado y pulsa **✉️ Correo**. Debe decir "Estado de cuenta enviado" y llegar con el PDF (revisa también *Spam* la primera vez).

Si dice "No se pudo enviar": revisa que la clave tenga 16 letras sin espacios, que el usuario sea el Gmail completo y que la verificación en 2 pasos esté activa. En Vercel → *Logs* aparece el motivo exacto (`[mail] error`).
Alternativa si algún día necesitas más volumen: Brevo (300 correos/día gratis) con `SMTP_HOST=smtp-relay.brevo.com`, puerto `587`.

---

## Costos y límites (casi todo $0; Mercado Pago sí cobra comisión)
| Servicio | Gratis incluye | Ojo |
|---|---|---|
| **GitHub** | Repos privados, 2.000 min/mes de compilación | — |
| **Supabase** | 500 MB base de datos, 1 GB de archivos | Pausa el proyecto tras 1 semana sin uso. El recordatorio diario (cron) lo mantiene activo; si se pausa, pulsa **Restore** en el panel |
| **Vercel (Hobby)** | Hosting y cron diario | El plan gratis es para uso **personal / no comercial**. Mientras pruebes o uses sin cobrar, bien. **Cuando empieces a cobrar suscripciones** debes pasar a Vercel Pro (~US$20/mes) o mover el sitio a otro hosting (se puede, el proyecto también corre con Docker). Verifica sus términos vigentes en vercel.com/legal/terms |
| **Mercado Pago** | Sin mensualidad | **Cobra comisión por cada pago a quien recibe el dinero** (Checkout Chile: 3,19% al instante o 2,89% a 10 días, más impuestos; puede cambiar, revisa mercadopago.cl). Para los apoderados es mejor la transferencia (sin costo). Por eso está **apagado por defecto** y cada curso debe solicitarlo |
| **Correos** | Brevo gratis: 300/día | Opcional (variables `SMTP_*`) |

---

## APK de Android y .exe de Windows
Ambos son envoltorios que abren tu sitio, así que se actualizan solos.
1. En GitHub: **Actions → "Compilar apps (Windows y Android)" → Run workflow** → escribe tu dirección `https://...vercel.app`.
2. Espera ~10–15 min y descarga los resultados (sección *Artifacts*): `CajaCurso-Windows` (.exe) y `CajaCurso-Android` (.apk).
3. Para compartirlos: crea un repositorio **público** vacío (ej. `cajacurso-descargas`) → **Releases → Create a new release** → arrastra el .apk y el .exe → publícalo. Copia el enlace de cada archivo.
4. En Vercel agrega `APK_URL` y `WINDOWS_URL` con esos enlaces y haz Redeploy. Aparecerán en `tu-sitio/descargas`.

**Sin compilar nada:** desde `/descargas` cualquiera puede **instalar la web como app** (botón "Instalar", o el ícono de instalar en la barra del navegador). En Windows y Android funciona igual que una app.

Avisos normales: Windows mostrará "editor desconocido" y Android pedirá permitir instalar desde orígenes desconocidos, porque no están firmadas.

---

## Actualizar después
- **Cambios de código:** se suben a GitHub y Vercel publica solo.
- **Cambios en la base de datos:** Claude te entregará un archivo `.sql` de actualización (ej. `supabase-actualizacion-1.sql`) para pegar en Supabase → SQL Editor → Run **antes** de publicar el código nuevo.

## Si algo falla
| Síntoma | Causa probable |
|---|---|
| Error al registrarse / página 500 | No se ejecutó `supabase-setup.sql`, o `DATABASE_URL` está mal (contraseña con símbolos raros, o falta el puerto 6543) |
| No aparece "Administración" | `ADMIN_EMAILS` no coincide exactamente con tu correo, o falta Redeploy |
| La boleta no se sube | Revisa `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` y que exista el bucket `boletas` |
| Los QR/enlaces apuntan a localhost | `APP_URL` mal configurada o falta Redeploy |
| "Unable to connect" tras días sin uso | Supabase pausó el proyecto → Restore |

Ante cualquier error, copia el mensaje (en Vercel: *Deployments → View logs*) y envíaselo a Claude.


## Perfil Centro de padres (auditoría de un colegio)
1. Antes de publicar la versión nueva, pega **`supabase-actualizacion-5.sql`** en Supabase → SQL Editor → Run.
2. El centro de padres crea su cuenta en `/register` eligiendo **“Soy del centro de padres”** y escribiendo el colegio. Queda *pendiente*.
3. Tú lo activas en **Administración → Usuarios → “Perfil Centro de padres”** (marcas “Perfil activado”; puedes corregir el nombre del colegio ahí). Solo tú puedes activarlo y desactivarlo.
4. Cada tesorero entra a **Accesos y QR → Centro de padres**, genera el código `AUD-…` y se lo entrega al centro.
5. El centro entra a `/centro`, pega el código en **Agregar curso** y ve ese curso (resumen, libro contable, gastos con boleta; Excel y PDF). Solo acepta cursos de **su** colegio. Si el tesorero genera un código nuevo o lo desactiva, el acceso se corta.
