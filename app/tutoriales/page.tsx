import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { PLANS } from "@/lib/brand";

export const metadata: Metadata = { title: "Tutoriales" };

const TUTORIALS: { id: string; icon: string; title: string; steps: string[]; tip: string }[] = [
  { id: "inicio", icon: "🏫", title: "Crear y configurar tu curso", steps: ["Inicia sesión o crea tu cuenta gratis.", "Pulsa «Crear nuevo curso».", "Completa colegio, curso, año, cuota mensual y meses de cobro.", "Guarda: obtienes el código del curso y el enlace para compartir."], tip: "Puedes cambiar la cuota después en Configuración." },
  { id: "alumnos", icon: "👦", title: "Agregar y gestionar alumnos", steps: ["Entra a Alumnos.", "Agrega uno a uno, o importa tu planilla Excel/CSV con columnas Nombre y Apellido (y opcionalmente RUT, Apoderado, Teléfono, Correo).", "Para exenciones o ingresos tardíos, edita «Cobrar desde / hasta»."], tip: "Si un alumno se retira, desactívalo: se conserva su historial." },
  { id: "pagos", icon: "💰", title: "Registrar pagos y abonos", steps: ["Entra a Pagos: alumnos en filas, meses en columnas.", "Toca la celda a registrar.", "Indica monto, fecha y método. Marca más meses si el comprobante cubre varios.", "Verde = pagado, amarillo = abonado, gris = pendiente."], tip: "Puedes eliminar un pago desde la misma ventana si te equivocaste." },
  { id: "ficha", icon: "📱", title: "Enviar la ficha por WhatsApp", steps: ["En Alumnos, junto a cada nombre, pulsa «WhatsApp» (necesita el teléfono) o «Copiar ficha».", "El apoderado abre el enlace y ve sus cuotas y deuda, sin crear cuenta.", "También puedes compartir el código del curso desde el Resumen."], tip: "La ficha individual es privada: solo quien tenga el enlace la ve." },
  { id: "gastos", icon: "🧾", title: "Gastos, ingresos extra y reportes", steps: ["En Gastos registra descripción, categoría, monto y la foto de la boleta.", "En Ingresos extra anota rifas, ventas o aportes.", "En Reportes revisa el balance, el análisis por alumno y exporta a Excel."], tip: "Imprime Reportes desde el navegador para la reunión de apoderados." },
  { id: "planes", icon: "⭐", title: "Plan Pro: Mercado Pago, Drive y recordatorios", steps: [`En Plan e integraciones activa los ${PLANS.trialDays} días de prueba.`, "Conecta Mercado Pago pegando tu Access Token de producción.", "Conecta Google Drive para respaldar las boletas.", "Activa recordatorios mensuales y agrega un segundo tesorero si lo necesitas."], tip: "El Pro se activa por curso; tus otros cursos siguen gratis." },
];

export default function TutorialsPage() {
  return (
    <InfoPage title="Tutoriales" intro="Guías paso a paso para gestionar tu curso desde el primer día.">
      {TUTORIALS.map((t) => (
        <section key={t.id} id={t.id} className="card scroll-mt-6">
          <h2 className="text-lg font-bold">{t.icon} {t.title}</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark">💡 {t.tip}</p>
        </section>
      ))}
    </InfoPage>
  );
}
