import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Términos de servicio" };

export default function TermsPage() {
  return (
    <InfoPage title="Términos de servicio" intro="Documento base. Revísalo con un abogado y complétalo con los datos de tu empresa antes de publicar.">
      <div className="card space-y-3 text-sm leading-relaxed">
        <p><b>1. Qué es {BRAND.name}.</b> Una herramienta para que tesoreros de cursos escolares registren cuotas, gastos e ingresos, y compartan el estado con los apoderados. La plataforma no maneja ni custodia el dinero del curso.</p>
        <p><b>2. Responsabilidad del tesorero.</b> Quien crea el curso es responsable de la exactitud de los datos que registra y de tener autorización de los apoderados para tratar sus datos de contacto.</p>
        <p><b>3. Planes.</b> El plan Gratis no tiene costo. El Plan Pro se contrata por curso, mensual o anual, y puede incluir un período de prueba. Los pagos se procesan por Mercado Pago. El Pro se activa por el período pagado.</p>
        <p><b>4. Pagos entre apoderados y tesorero.</b> Cuando el tesorero conecta su cuenta de Mercado Pago, los pagos de los apoderados llegan directamente a esa cuenta. {BRAND.name} solo registra la información del pago.</p>
        <p><b>5. Uso aceptable.</b> No se permite usar la plataforma para actividades ilícitas, intentar acceder a datos de otros cursos o interferir con el servicio.</p>
        <p><b>6. Disponibilidad.</b> Procuramos mantener el servicio disponible, sin garantizar que esté libre de interrupciones o errores.</p>
        <p><b>7. Cambios y contacto.</b> Podemos actualizar estos términos avisando en la plataforma. Consultas: {BRAND.supportEmail}.</p>
      </div>
    </InfoPage>
  );
}
