import Link from "next/link";
import Logo from "@/components/Logo";
import CodeForm from "@/components/CodeForm";
import { BRAND, PLANS } from "@/lib/brand";
import { clp } from "@/lib/finance";
import { getUser } from "@/lib/auth";

const FEATURES = [
  ["Balance al día", "Cuotas, ingresos extra y gastos en un solo vistazo. Sin planilla que se pierde."],
  ["El apoderado ve su ficha", "Le mandas un enlace por WhatsApp y ve sus cuotas y deuda. Con Pro, puede pagar en línea."],
  ["Un comprobante, varios meses", "Registra abonos y pagos que cubren varios meses de una sola vez."],
  ["Gastos con boleta", "Sube la foto de cada boleta desde el celular. Los apoderados pueden verificar el respaldo."],
  ["Un curso, una tesorería", "Cada curso es independiente. El Plan Pro se activa solo en el que lo necesite."],
  ["Como app en tu equipo", "Instálala en el celular, en Windows o úsala desde el navegador. Mismos datos en todos lados."],
];

const STEPS = [
  ["Crea tu cuenta", "Solo correo y contraseña. Un minuto."],
  ["Arma el curso", "Colegio, curso, cuota y meses de cobro. Obtienes el código y el enlace."],
  ["Carga a los alumnos", "Uno a uno o importando tu planilla de Excel."],
  ["Cobra y comparte", "Registra pagos y gastos, y envía la ficha por WhatsApp."],
];

export default async function Home() {
  const user = await getUser();
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-2 text-sm">
            <a href="#planes" className="hidden px-3 py-2 font-medium sm:block">Planes</a>
            <Link href="/descargas" className="hidden px-3 py-2 font-medium sm:block">Descargar app</Link>
            <Link href="/ayuda" className="hidden px-3 py-2 font-medium sm:block">Ayuda</Link>
            {user ? (
              <Link href="/app" className="btn">Ir a mis cursos</Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">Iniciar sesión</Link>
                <Link href="/register" className="btn">Registrarse</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div className="space-y-5">
            <span className="badge bg-brand-soft text-brand-dark">Tesorería escolar en Chile</span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{BRAND.tagline}</h1>
            <p className="max-w-lg text-lg text-muted">
              Pagos, gastos y la ficha del apoderado, sin Excel. El plan base es gratis y el Plan Pro suma correos con PDF, recordatorios, ventas para eventos, aportes y más.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="btn !px-6 !py-3 text-base">Crear cuenta gratis</Link>
              <Link href="/login" className="btn-ghost !px-6 !py-3 text-base">Iniciar sesión</Link>
            </div>
            <div className="max-w-md space-y-2 pt-2">
              <p className="text-sm font-semibold">¿Eres apoderado o directivo? Ingresa tu código (o escanea el QR)</p>
              <CodeForm />
            </div>
          </div>

          <div className="card self-center !p-6" aria-hidden="true">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="font-bold">3° Medio A · 2026</p><p className="text-xs text-muted">Ejemplo ilustrativo</p></div>
              <span className="badge bg-amber-100 text-amber-900">Pro</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[["Alumnos", "32"], ["Recaudado", "$1.280.000"], ["Balance", "$940.000"]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">{k}</p><p className="font-bold">{v}</p></div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-semibold">
              <span className="rounded-lg bg-emerald-100 py-2 text-emerald-900">Mar ✓</span>
              <span className="rounded-lg bg-emerald-100 py-2 text-emerald-900">Abr ✓</span>
              <span className="rounded-lg bg-slate-100 py-2">May</span>
              <span className="rounded-lg bg-slate-100 py-2">Jun</span>
            </div>
          </div>
        </section>

        <section id="funciones" className="bg-white py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold">Menos Excel. Más claridad.</h2>
            <p className="mt-2 max-w-2xl text-muted">Hecho para el tesorero del curso: pagos, gastos y un enlace que el apoderado abre en el celular.</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(([t, d]) => (
                <li key={t} className="card"><h3 className="font-bold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-3xl font-bold">De cero a caja ordenada en cuatro pasos</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="card">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 font-bold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="planes" className="bg-white py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold">Gratis, mensual o anual. Tú eliges.</h2>
            <p className="mt-2 max-w-2xl text-muted">
              La base no se cobra. El Pro es opcional, se activa en un solo curso y parte con {PLANS.trialDays} días de prueba sin tarjeta.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="card flex flex-col">
                <p className="text-sm font-semibold text-muted">Para siempre</p>
                <h3 className="text-xl font-bold">Gratis</h3>
                <p className="my-3 text-3xl font-extrabold">$0 <span className="text-base font-medium text-muted">/ mes</span></p>
                <ul className="flex-1 space-y-1.5 text-sm">
                  <li>✓ Cuotas, abonos y gastos</li><li>✓ Ficha del apoderado</li><li>✓ Reportes del curso y Excel</li>
                  <li>✓ Hasta {PLANS.freeExtraLimit} ingresos extra</li>
                </ul>
                <Link href="/register" className="btn-ghost mt-5">Crear cuenta gratis</Link>
              </div>
              <div className="card flex flex-col">
                <p className="text-sm font-semibold text-muted">Flexible</p>
                <h3 className="text-xl font-bold">Pro mensual</h3>
                <p className="my-3 text-3xl font-extrabold">{clp(PLANS.monthly.price)} <span className="text-base font-medium text-muted">/ mes</span></p>
                <ul className="flex-1 space-y-1.5 text-sm">
                  <li>✓ Todo lo de Gratis</li><li>✓ Aportes y colectas</li><li>✓ Ventas para eventos</li><li>✓ Google Drive para boletas</li>
                  <li>✓ Correos y recordatorios</li><li>✓ Ingresos extra ilimitados</li><li>✓ Segundo tesorero (vista o admin)</li>
                  <li>✓ PDF para la reunión de apoderados</li>
                </ul>
                <Link href="/register" className="btn-ghost mt-5">Empezar mensual</Link>
              </div>
              <div className="card flex flex-col border-brand ring-2 ring-brand/20">
                <p className="text-sm font-semibold text-brand">Recomendado</p>
                <h3 className="text-xl font-bold">Pro anual</h3>
                <p className="my-3 text-3xl font-extrabold">{clp(PLANS.annual.price)} <span className="text-base font-medium text-muted">/ año</span></p>
                <p className="text-sm text-muted">≈ {clp(Math.round(PLANS.annual.price / 12))} al mes · ahorras {clp(PLANS.monthly.price * 12 - PLANS.annual.price)} frente a 12 meses sueltos</p>
                <ul className="mt-2 flex-1 space-y-1.5 text-sm">
                  <li>✓ Todo el Pro, 12 meses</li><li>✓ El mejor precio del año</li><li>✓ {PLANS.trialDays} días de prueba al partir</li>
                </ul>
                <Link href="/register" className="btn mt-5">Elegir anual</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
          <p>© {new Date().getFullYear()} {BRAND.name}</p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/descargas">Descargar app</Link><Link href="/ayuda">Ayuda</Link><Link href="/faq">Preguntas frecuentes</Link>
            <Link href="/terminos">Términos</Link><Link href="/privacidad">Privacidad</Link>
            <a href={`mailto:${BRAND.supportEmail}`}>Contacto</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
