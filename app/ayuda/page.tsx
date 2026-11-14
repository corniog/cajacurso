import Link from "next/link";
import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Centro de ayuda" };

export default function HelpPage() {
  return (
    <InfoPage title="Centro de ayuda del tesorero" intro="Manual paso a paso, preguntas frecuentes y contacto. Si es tu primer año a cargo de las cuotas, empieza por los tutoriales.">
      <div className="grid gap-4 sm:grid-cols-3">
        {[["/tutoriales", "🎓 Tutoriales", "Curso, alumnos, pagos, ficha, gastos y Plan Pro."], ["/faq", "❓ Preguntas frecuentes", "Respuestas rápidas a las dudas más comunes."], [`mailto:${BRAND.supportEmail}`, "💬 Soporte", "Escríbenos si no encontraste lo que buscabas."]].map(([h, t, d]) => (
          <Link key={h} href={h} className="card transition hover:border-brand"><p className="font-bold">{t}</p><p className="mt-1 text-sm text-muted">{d}</p></Link>
        ))}
      </div>
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Guía de inicio rápido</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li><b>Crea tu cuenta y el curso.</b> Colegio, curso, año, cuota y meses de cobro.</li>
          <li><b>Agrega a los alumnos.</b> Nombre y apellido bastan. El teléfono y correo del apoderado sirven para WhatsApp y avisos.</li>
          <li><b>Registra pagos y abonos.</b> Grilla mes a mes; un comprobante puede cubrir varios meses.</li>
          <li><b>Envía la ficha por WhatsApp.</b> Cada alumno tiene su enlace; también existe el código del curso.</li>
          <li><b>Registra gastos e ingresos extra</b> y revisa el balance en Reportes.</li>
          <li><b>Prueba el Plan Pro</b> si lo necesitas: 30 días en un curso.</li>
        </ol>
      </section>
    </InfoPage>
  );
}
