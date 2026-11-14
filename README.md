# CajaCurso

Tesorería para cursos escolares: pagos, gastos, ficha del apoderado, accesos por código/QR, vista de directivos y planes Gratis/Pro. Web, Android y Windows.

Para publicarlo gratis **sin instalar nada** (GitHub + Supabase + Vercel), sigue **GUIA-PUBLICAR.md**.
Para el detalle completo del proyecto, decisiones y pendientes, lee **CONTEXTO.md**.

## 1. Publicar la plataforma web (Docker)
Necesitas un servidor con Docker y un dominio con HTTPS (por ejemplo con Caddy o Nginx delante del puerto 3000).

```bash
cp .env.example .env
# Edita .env: DB_PASSWORD, AUTH_SECRET (32+ caracteres aleatorios), APP_URL=https://tudominio.cl
docker compose up -d --build
```
Las migraciones se aplican solas al iniciar. Respalda los volúmenes `dbdata` (base de datos) y `uploads` (boletas).

### Servicios opcionales (Plan Pro)
| Función | Variables |
|---|---|
| Correos y recordatorios | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Cobro del Plan Pro | `MP_PLATFORM_ACCESS_TOKEN` (cuenta Mercado Pago de la plataforma) |
| Google Drive | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirección: `APP_URL/api/integrations/drive/callback`) |
| Recordatorios automáticos | `CRON_SECRET` y un cron diario: `curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/reminders` |
| Mercado Pago de cada tesorero | lo conecta cada uno en su curso (Plan e integraciones) |

Webhook de Mercado Pago de la plataforma: `APP_URL/api/webhooks/mp/platform` (se configura solo por la `notification_url` de cada cobro).

## 2. Instalador de Windows y APK de Android
Ambas apps son envoltorios que abren tu plataforma publicada, así que se actualizan solas al actualizar la web.

**Opción recomendada (sin instalar nada):** sube el proyecto a GitHub y ejecuta *Actions → Compilar apps → Run workflow* indicando tu URL `https://tudominio.cl`. Descarga los artefactos `CajaCurso-Windows` (.exe) y `CajaCurso-Android` (.apk).

**Compilar en tu computador**
```bash
npm install && node scripts/make-icons.mjs
node scripts/set-app-url.mjs https://tudominio.cl

# Windows (en Windows)
cd desktop && npm install && npm run dist        # desktop/dist/CajaCurso-Setup-1.0.0.exe

# Android (necesita Android Studio / SDK y JDK 21)
cd mobile && npm install && npx cap add android && npx capacitor-assets generate --android
npx cap sync android && cd android && ./gradlew assembleDebug
```
Luego sube los archivos a tu servidor y define `APK_URL` y `WINDOWS_URL` para que aparezcan en la página `/descargas`.

Además, desde el navegador cualquiera puede **instalar la PWA** (botón en `/descargas`).

## 3. Desarrollo
```bash
npm install
cp .env.example .env.local
node scripts/migrate.mjs
npm run dev
```
Prueba de extremo a extremo (con la app compilada y corriendo): `node e2e/flow.mjs` (requiere Chrome; ajusta `CHROME`).
