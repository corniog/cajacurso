import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { PLANS } from "@/lib/brand";
import { clp } from "@/lib/finance";

export const metadata: Metadata = { title: "Preguntas frecuentes" };

const FAQ: [string, [string, string][]][] = [
  ["Primeros pasos", [
    ["¿Es gratis?", `Sí. El plan Gratis incluye alumnos, cuotas, abonos, gastos, ficha del apoderado y reportes. El Plan Pro (${clp(PLANS.monthly.price)} al mes o ${clp(PLANS.annual.price)} al año) es opcional y parte con ${PLANS.trialDays} días de prueba.`],
    ["¿Cómo creo mi curso?", "Regístrate, entra a Mis cursos y elige «Crear nuevo curso». Indica colegio, curso, año, cuota y meses de cobro. Se genera un código único para compartir."],
    ["¿Necesito instalar algo?", "No. Funciona en el navegador. Si quieres, puedes instalarla como app en el celular (Android), en Windows o agregarla a la pantalla de inicio."],
  ]],
  ["Pagos", [
    ["¿Cómo registro un pago?", "En Pagos, toca la celda del alumno y el mes. Indica monto, fecha y método."],
    ["¿Puedo registrar abonos?", "Sí. Si el monto no alcanza la cuota, el mes queda como «abonado» y puedes completar después."],
    ["¿Y si un comprobante cubre varios meses?", "Marca todos los meses que cubre en el mismo registro: el monto se reparte en orden."],
    ["¿Cómo exento a un alumno de ciertos meses?", "En Alumnos → Editar, define «Cobrar desde» y «Cobrar hasta». Los meses fuera de ese rango aparecen como «No aplica»."],
    ["¿Puedo registrar rifas u otros ingresos?", `Sí, en Ingresos extra. El plan Gratis admite hasta ${PLANS.freeExtraLimit}; el Pro no tiene tope.`],
  ]],
  ["Apoderados", [
    ["¿Cómo ven los apoderados sus pagos?", "Cada alumno tiene un enlace de ficha que puedes enviar por WhatsApp. También pueden ingresar el código del curso en la página de inicio para ver el resumen del curso."],
    ["¿Qué ven con el código del curso?", "Un resumen del curso: dinero disponible, cuotas recaudadas, porcentaje de avance, gráficos y, si tú lo permites, los gastos con boleta. Nunca ven a otros alumnos ni lo que ha pagado cada uno; eso solo lo ve el tesorero y la directiva."],
    ["¿El RUT es obligatorio?", "No. Solo el nombre y apellido."],
  ]],
  ["Reportes y seguridad", [
    ["¿Puedo exportar la información?", "Sí: Excel en todos los planes y PDF para la reunión de apoderados en el Plan Pro."],
    ["¿Cómo protegen mis datos?", "Conexión cifrada (HTTPS), contraseñas con hash seguro, sesiones protegidas, límite de intentos de inicio de sesión y credenciales de terceros cifradas."],
    ["¿Puedo eliminar mi curso o mi cuenta?", "Puedes eliminar un curso desde Configuración. Para borrar tu cuenta, escríbenos y lo procesamos."],
  ]],
];

export default function FaqPage() {
  return (
    <InfoPage title="Preguntas frecuentes" intro="Respuestas rápidas sobre cómo usar la plataforma.">
      {FAQ.map(([group, items]) => (
        <section key={group} className="space-y-2">
          <h2 className="text-lg font-bold">{group}</h2>
          {items.map(([q, a]) => (
            <details key={q} className="card !py-3">
              <summary className="cursor-pointer font-semibold">{q}</summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </section>
      ))}
    </InfoPage>
  );
}
