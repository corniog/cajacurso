# CONTEXTO DEL PROYECTO — CajaCurso (tesorería para cursos escolares)

> Pega este documento al inicio de un chat nuevo (junto con el código o el .zip) para continuar sin perder nada.

## 1. Qué es y qué pidió el usuario
Plataforma web para **tesoreros de cursos de colegios en Chile**, equivalente en funciones y planes a tesoreroescolar.cl, disponible como:
- **Sitio web / PWA** (instalable desde el navegador)
- **App Android (APK)**
- **Instalador de Windows (.exe)**

Decisiones del usuario: stack **Next.js + PostgreSQL**, alcance **todo de una vez**, el nombre lo propone Claude (nombre de trabajo: **CajaCurso**, cambiable en `lib/brand.ts`).
Idioma de toda la interfaz: español de Chile. Moneda: CLP.

Nota legal: es una plataforma propia con funciones equivalentes, **no una copia** (nombre, logo, textos y diseño son originales). Términos y Privacidad son borradores: deben revisarse con un abogado.

## 2. Requisitos añadidos después
1. **Correo a apoderados con PDF** adjunto (estado de cuenta): individual, masivo, recordatorio de deuda y aviso al registrar un pago. *(Plan Pro)*
2. **Apoderados**: con un **código corto o QR** entran solo a la ficha de su hijo(a).
3. **Directivos**: un código/QR para ver **todo en solo lectura**, con descarga de Excel y PDF, sin editar.
4. **Dos tesoreros**: tesorero principal + **co-tesorero** (máximo 1; puede registrar pagos/gastos y enviar correos; no cambia plan, configuración ni elimina el curso).

## 3. Funciones del original que se replicaron
- Cursos (colegio, curso, año, cuota, meses de cobro) con código único; un tesorero puede tener varios cursos.
- Alumnos (nombre y apellido obligatorios; RUT, apoderado, teléfono, correo opcionales), importación Excel/CSV, rango de cobro individual ("No aplica"), desactivar sin borrar.
- Pagos: grilla alumnos × meses (pendiente / abonado / pagado), abonos, **un comprobante que cubre varios meses**.
- Gastos con categoría, proveedor, N° de boleta y **foto de boleta**.
- Ingresos extra (curso completo o alumnos específicos).
- Reportes (balance, por mes, por categoría, por alumno), imprimir, exportar.
- Ficha del apoderado por enlace + código del curso (vista general).
- Seguridad: HTTPS, bcrypt, CSRF (cookie SameSite + acciones de servidor), límite de intentos de login.

### Planes (precios del original)
| Plan | Precio | Incluye |
|---|---|---|
| Gratis | $0 | Todo lo básico, Excel, **máx. 10 ingresos extra** |
| Pro mensual | $4.990/mes | Mercado Pago en la ficha, Google Drive para boletas, correos/recordatorios, extras ilimitados, co-tesorero, PDF para reunión |
| Pro anual | $18.990/año | Lo mismo, 12 meses |

El Pro se activa **por curso**; 30 días de prueba (una sola vez por curso).

## 4. Stack y estructura
Next.js 16.4 (App Router, Turbopack, `output: "standalone"`), React 19, TypeScript, Tailwind 4, Drizzle ORM + PostgreSQL 16, jose (sesión JWT en cookie httpOnly), bcryptjs, zod, exceljs, pdfkit, nodemailer, mercadopago, googleapis, qrcode.

**Ojo Next 16:** `middleware` se llama **`proxy.ts`**; `PageProps`/`LayoutProps`/`RouteContext` se generan con `npx next typegen`; no usar `export const runtime`; no pasar funciones inline a componentes cliente (usar `accion.bind(null, id)`). Hay que leer `node_modules/next/dist/docs/` antes de tocar APIs de Next.

```
app/
  page.tsx                  landing + planes + selector de código
  login, register
  app/                      panel del tesorero (protegido por proxy.ts + requireCourse)
    c/[id]/  (resumen, alumnos, pagos, gastos, extras, libro, eventos(+productos, ajustes, [eventId]), reportes, accesos(+qr), plan, config)
  b/[token]                 boleta pública de un evento
  c/[code]                  vista pública del curso (apoderados)
  f/[token]                 ficha del alumno (token largo del QR O código corto XXXXX-XXXXX)
  d/[code]                  vista de directivos (DIR-XXXXXXXXXXXX), solo lectura
  descargas, ayuda, faq, tutoriales, terminos, privacidad
  actions/ (auth, course, pro, ficha, admin, events, ledger)  acciones de servidor
  api/  (export, receipt, f/pdf, d/export, d/receipt, p/receipt, webhooks/mp, integrations/drive, cron/reminders)
lib/  (db/schema, features, events, event-pdf, ledger, ledger-data, ledger-export, kpi, db/schema, auth, finance, plans, export, statement, reminders, mail, mp, drive, storage, crypto, qr, util, public-data, course-data, brand)
components/  desktop/ (Electron)  mobile/ (Capacitor)  scripts/  e2e/flow.mjs  drizzle/ (migraciones)
Dockerfile  docker-compose.yml  .github/workflows/build-apps.yml
```

### Reglas clave de negocio (lib/finance.ts, lib/plans.ts)
- Estado de mes: pagado si pagado ≥ cuota; abonado si > 0; pendiente; "no aplica" fuera del rango del alumno.
- Deuda vencida = meses ≤ mes actual del año del curso.
- Pago multi-mes: se reparte en orden cubriendo lo que falta de cada mes; el sobrante va al último mes.
- Gratis: tope 10 extras. Pro vigente si `courses.pro_until > now`. Un pago extiende desde el vencimiento actual.

### Accesos y privacidad
- `students.token` (18 chars, va en el QR) y `students.short_code` (para digitar). Ambos abren **solo** esa ficha.
- `courses.code` (curso): nombres como "Ana P.", sin montos por alumno; el tesorero decide si se muestran alumnos/gastos (`public_students`, `public_expenses`).
- `courses.directive_code` (`DIR-…`): lectura total; se puede regenerar (invalida el anterior) o desactivar. PDF de directivos solo si el curso es Pro.
- Credenciales de Mercado Pago/Drive del tesorero se guardan **cifradas** (AES-256-GCM con `AUTH_SECRET`).
- Webhooks de Mercado Pago: no se confía en el cuerpo; se consulta el pago a la API de MP con el token correspondiente.

## 4b. Despliegue gratuito y panel de administrador (agregado después)
El usuario **no puede instalar nada** y quiere costo $0: **GitHub + Supabase (Postgres + Storage) + Vercel**. Guía completa: **GUIA-PUBLICAR.md**.
- BD: `DATABASE_URL` = *transaction pooler* de Supabase (puerto 6543). `lib/db/index.ts` usa `prepare:false`, SSL y 1 conexión en Vercel.
- Esquema: se instala pegando **`supabase-setup.sql`** en el SQL Editor (lo genera `node scripts/build-setup-sql.mjs` desde `drizzle/`; activa RLS en las 16 tablas y crea el bucket privado `boletas`). Cada nueva migración de `drizzle/` → regenerar ese archivo.
- Boletas: `lib/storage.ts` usa Supabase Storage si existen `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`; si no, disco local (`UPLOAD_DIR`). Vercel limita el cuerpo a ~4,5 MB: `components/ReceiptInput.tsx` comprime las fotos en el navegador; máximo 4 MB por archivo.
- `next.config.ts`: `output: "standalone"` solo con `STANDALONE=1` (Docker). `serverExternalPackages: ["pdfkit"]`, `serverActions.bodySizeLimit: "5mb"`.
- Se reemplazó `googleapis` por `@googleapis/drive` (peso en Vercel). `vercel.json` programa el cron diario `/api/cron/reminders` (Vercel envía `Authorization: Bearer $CRON_SECRET`); además mantiene viva la BD de Supabase gratis.
- **Panel `/admin`** (acceso por `ADMIN_EMAILS`, correos separados por coma, validado en `lib/admin.ts` + `proxy.ts`): resumen/estadísticas, **solicitudes por transferencia** (aprobar/rechazar), **cursos y planes** (sumar días, fijar fecha, quitar Pro, permitir otra prueba, buscador), **historial** de suscripciones. Acciones en `app/actions/admin.ts`.
- Planes: `subscriptions` ahora tiene `method` (mercadopago | transferencia | manual | prueba) y `note`; `plan` admite `manual`. El tesorero elige en *Plan e integraciones*: **Mercado Pago** (automático) o **transferencia** (muestra `TRANSFER_INFO`, crea solicitud pendiente que el admin aprueba). Máx. 1 solicitud pendiente por curso. Los precios siguen en `lib/brand.ts` (no editables desde el panel).
- Riesgo conocido: no hay verificación de correo; quien se registre primero con un correo de `ADMIN_EMAILS` queda como admin → registrarse de inmediato tras desplegar.
- **Vercel Hobby es solo para uso no comercial** (según sus términos; confirmar en vercel.com/legal/terms): al empezar a cobrar, pasar a Vercel Pro o a otro hosting (el proyecto también corre con Docker).
- Cloudflare se descartó: dependencias Node (pdfkit, nodemailer, exceljs) incompatibles sin trabajo extra.

## 4c. Funciones agregadas en noviembre de 2026
**Estado de producción:** `https://cajacurso.vercel.app` (Vercel Hobby) + Supabase (pooler 6543 + bucket `boletas`) + GitHub `corniog/cajacurso`. Al 16-nov-2026 el usuario ya registró curso, pagos, WhatsApp/PDF y correo se probó solo hasta mostrar el aviso (SMTP aún no configurado).

- **Funciones por curso (`lib/features.ts`)**: `hasFeature(course, key)` decide si una función Pro está disponible: `courses.features` (jsonb) tiene un valor por función (`true` = activada, `false` = bloqueada, ausente = según el plan). Claves: `email, reminders, drive, mercadopago, pdf, extras, coTreasurer, events`. El administrador las controla en **/admin/cursos → "Funciones del curso"** (acción `setFeatures`), por ejemplo para dar "Ventas para eventos" a un curso gratis. Todo el código usa `hasFeature` (ya no `isPro` directo, salvo mostrar el estado del plan).
- **KPI del tesorero**: `components/KpiDashboard.tsx` (caja, recaudación, gráficos) se usa en el Resumen del tesorero y en la vista pública `/c/[code]`. Los gráficos (`components/KpiCharts.tsx`) son SVG en componentes cliente con **cuadro flotante** al pasar el mouse o tocar (dona, línea, barras).
- **Ventas para eventos** (`/app/c/[id]/eventos`, función `events`, Pro u otorgada por el admin). Reemplaza el sistema externo en Apps Script del usuario (productos terminados, sin recetas ni costos):
  - Tablas: `event_products` (precio, stock opcional, activo), `events`, `event_docs` (venta B-0001 / fiado F-0001 / presupuesto P-0001, con `token` público), `event_lines`, `event_settings` (nombre, dirección, teléfono, correo, pie y **logo** ≤60 KB como data URL).
  - Lógica en `app/actions/events.ts`: crear venta/fiado/presupuesto (descuenta stock en transacción; presupuesto no descuenta), "Ya me pagó" (fiado→pagado), convertir presupuesto en venta, eliminar (devuelve stock), correo con PDF (`emailDoc`), **cerrar evento** = crea un *ingreso extra* "Evento: nombre" con lo cobrado (ventas + fiados pagados); reabrir lo elimina/actualiza. Ese ingreso queda bloqueado para edición en el libro.
  - Pantallas: lista, `/productos`, `/ajustes` (datos y logo), `/[eventId]` con pestañas Vender (POS `components/EventPos.tsx`), Ventas, Fiados, Presupuestos, Resumen. Boleta pública `/b/[token]` y PDF `/api/b/[token]/pdf` (ticket 80 mm, `lib/event-pdf.ts`). Compartir por WhatsApp (`wa.me`), correo, imprimir.
- **Libro de contabilidad** (`/app/c/[id]/libro`, gratis para todos los planes): `lib/ledger.ts` lo **arma en vivo** con cuotas (`payments`), ingresos extra y gastos, ordenado por fecha con N° correlativo y saldo acumulado; por eso nunca queda desfasado. Incluye **cuadratura** contra el resumen de la aplicación (cuotas, extras, total ingresos, egresos, saldo).
  - **Corrección validada** (`app/actions/ledger.ts`: `editPayment/editExpense/editExtra/deleteFromLedger`): en una transacción recalcula los totales sumando directo en la base y compara con lo esperado; si no cuadra, revierte ("no deja editar"). Reglas: una cuota no puede dejar un mes sobre la cuota mensual; no se puede dejar el saldo en caja negativo; pagos de Mercado Pago e ingresos que vienen de un evento cerrado están bloqueados (🔒).
  - **Bitácora** `ledger_audit`: cada corrección/eliminación guarda quién, cuándo, antes y después.
  - **Descargas**: `/api/c/[id]/libro/pdf` (apaisado, cuadratura, totales, bitácora, firmas de tesorero/directiva) y `/xlsx` (hojas Libro con fórmulas SUM, Cuadratura, Bitácora).
- **Migraciones nuevas**: `0004_eventos_y_funciones` y `0005_libro_contable`. Para producción: pegar **`supabase-actualizacion-1.sql`** en Supabase antes de desplegar (el código nuevo exige `courses.features`). `supabase-setup.sql` ya incluye todo (16 tablas con RLS).
- **Texto de Mercado Pago corregido**: el tesorero (dueño del curso, con la función `mercadopago`) ve en *Plan e integraciones* el bloque "Mercado Pago en la ficha"; el Access Token de **producción** está en mercadopago.cl/developers → Tus integraciones → (crear aplicación) → Credenciales → Producción (hay que "Activar ambiente de producción"). Los apoderados NO ven ese bloque: solo ven el botón de pago en su ficha.
- **Botón "Conectar con Mercado Pago" (OAuth)**: `lib/mp.ts` (`mpAuthUrl`, `connectMpWithCode`, `getCourseMpToken` que renueva el token con `refresh_token` cuando vence en <15 días) + rutas `/api/integrations/mp/start` y `/callback` (state en cookie `cc_mp_state`). Requiere `MP_CLIENT_ID` y `MP_CLIENT_SECRET` (aplicación del administrador con Redirect URL `APP_URL/api/integrations/mp/callback`); sin ellos se mantiene el pegado manual del Access Token. Migración `0006_mp_oauth` (`integrations.mp_refresh_token, mp_expires_at, mp_user_id`) → `supabase-actualizacion-2.sql`. **No probado contra Mercado Pago real** (solo redirección y rechazo de state inválido: `e2e/mp-oauth.mjs` 4/4).
- **Aportes y colectas** (`/app/c/[id]/aportes`, función `contributions`, Pro u otorgada por el admin): cobros distintos de la cuota mensual (regalo de la profesora, ventas, compras). Tablas `contributions` (colecta con monto sugerido opcional y fecha límite) y `contribution_payments` (aporte del apoderado: pendiente/confirmado/rechazado, método mercadopago o transferencia); `courses.transfer_info` guarda los datos bancarios que el tesorero publica. En la ficha del apoderado, `components/ContributionBox.tsx` (aviso claro: "no se descuenta de tus cuotas") permite elegir una colecta u "Otro", y pagar en línea (si el curso tiene Mercado Pago conectado; el webhook confirma solo con referencia `c:<id>`) o "Ya transferí" (queda pendiente hasta que el tesorero pulsa Confirmar). `lib/contributions.ts#confirmContribution` (idempotente) marca confirmado y crea el ingreso extra `Aporte: concepto · alumno`, que entra a totales y libro y queda bloqueado para edición/eliminación (se gestiona desde Aportes). Máx. 5 aportes pendientes por alumno. Migración `0007_aportes`; ambos SQL (0006+0007) van en `supabase-actualizacion-2.sql`. Prueba: `e2e/aportes.mjs` 10/10. Mercado Pago real sin probar.
- **Dos usos de Mercado Pago**: (1) plan Pro del tesorero → cuenta del administrador (`MP_PLATFORM_ACCESS_TOKEN`); (2) cuotas de apoderados → cuenta del tesorero (token del curso, por Access Token manual o por el botón).
- `app/api/health/route.ts` es una ruta de diagnóstico TEMPORAL (requiere `?k=CRON_SECRET`): borrarla cuando el usuario confirme que todo funciona.
- **Pruebas**: `node e2e/flow.mjs` 50/50, `node e2e/admin.mjs` 24/24 (incluye activar/bloquear funciones por curso), `node e2e/libro-eventos.mjs` 19/19 (libro, cuadratura, corrección rechazada/aceptada, bitácora, PDF/Excel, eventos con stock, fiado, boleta pública, cierre de evento, KPI y cuadro flotante).

## 5. Estado actual
**Verificado con Chrome real (ver 4c para las cifras más recientes): `node e2e/flow.mjs` 50/50, `node e2e/admin.mjs` 24/24, `node e2e/libro-eventos.mjs` 19/19** (panel admin, transferencia, plan manual, compresión de foto). Almacenamiento Supabase probado solo contra un servidor simulado (`e2e/storage-mock.test.mts`). Lo anterior verificado: registro/login, curso, alumnos, RUT inválido, pagos (completo, abono, multi-mes, eliminar), gastos con boleta (y rechazo de .exe), límite de 10 extras, balance correcto, Excel/PDF, directivos (solo lectura, boletas, Excel, PDF con Pro), apoderado por código corto, PDF del apoderado, código del curso, QR, prueba Pro, co-tesorero (permisos y límite de 1), bloqueo de login, cierre de sesión. Migrador probado sobre base vacía. Proyecto Android generado con éxito por Capacitor.

**NO verificado (no hay acceso desde el entorno de desarrollo):**
- **Supabase y Vercel reales** (BD con pooler, Storage, build en Vercel, cron). Se probó el SQL en Postgres local y el cliente de Storage contra un simulador.
- Envío real de correos (falta SMTP). Sin SMTP la app avisa con claridad.
- Cobro real con **Mercado Pago** (plan y pago del apoderado) y webhooks.
- **Google Drive** (OAuth y subida).
- **Compilar el APK** (no hay Android SDK) y el **.exe** (Electron se descarga de GitHub, bloqueado). Hay scripts y un flujo de GitHub Actions listos, **sin ejecutar**.
- Despliegue con Docker (no hay Docker en el entorno). El `Dockerfile` no se ha construido.

## 6. Pendiente / siguientes pasos sugeridos
1. Desplegar siguiendo **GUIA-PUBLICAR.md** (GitHub → Supabase → Vercel) y reportar cualquier error real.
2. Ejecutar el flujo de GitHub Actions para obtener APK y .exe; subirlos y poner `APK_URL` / `WINDOWS_URL`.
3. Probar de punta a punta con credenciales reales: SMTP, Mercado Pago (usuario de pruebas), Google OAuth (consentimiento de Drive).
4. Cobro del plan hoy es **pago único por período** (mensual/anual), **no suscripción automática**: decidir si se quiere renovación recurrente.
5. Firmar el .exe y el APK (certificado/keystore) para evitar avisos; el APK actual es "debug".
6. Mejoras: notificaciones push, exportar con logo del colegio, modo offline real, más de un curso por apoderado, WhatsApp automático.
7. Revisión legal de Términos/Privacidad (datos de menores, Ley 19.628/21.719) y registro de marca/nombre definitivo.
8. Subir `AUTH_SECRET` robusto y respaldos de base de datos y de la carpeta de boletas.

## 7. Cómo ejecutar en local
```bash
npm install
cp .env.example .env.local        # completar DATABASE_URL y AUTH_SECRET (>=32 chars)
node scripts/migrate.mjs          # crea las tablas (o pega supabase-setup.sql en Supabase)
npm run dev                       # http://localhost:3000
# pruebas (con el servidor de producción levantado): node e2e/flow.mjs
```
En el entorno de desarrollo de Claude, PostgreSQL local corre en el puerto **5433** con datos en `/tmp/cajacurso-pgdata` (es efímero; si se pierde, correr `scripts/migrate.mjs` en una base nueva).

## 8. Convenciones
- Textos de la interfaz en español; errores claros y accionables.
- Todo acceso a datos de un curso pasa por `requireCourse(id, { write })`.
- Cambios de esquema: editar `lib/db/schema.ts` → `npx drizzle-kit generate` (y `push` en desarrollo). Las migraciones de `drizzle/` son las que aplica producción.
