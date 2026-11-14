import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PrivacyPage() {
  return (
    <InfoPage title="Política de privacidad" intro="Documento base. Debe revisarse con un abogado para ajustarlo a la normativa chilena de protección de datos personales vigente.">
      <div className="card space-y-3 text-sm leading-relaxed">
        <p><b>Qué datos tratamos.</b> De los tesoreros: nombre, correo y contraseña (almacenada con hash). De los alumnos y apoderados, lo que el tesorero registre: nombre, RUT (opcional), contacto del apoderado, pagos y gastos del curso.</p>
        <p><b>Para qué.</b> Para operar la tesorería del curso, mostrar a los apoderados su estado de cuenta y, con el Plan Pro, enviar avisos por correo y habilitar pagos en línea.</p>
        <p><b>Qué ven los apoderados.</b> Con el código del curso ven el resumen general y, si el tesorero lo permite, una lista con nombre y la inicial del apellido sin montos. La ficha individual solo es accesible con el enlace privado de cada alumno.</p>
        <p><b>Terceros.</b> Mercado Pago (pagos), Google Drive (respaldo de boletas, opcional) y el proveedor de correo, solo cuando el tesorero activa esas funciones.</p>
        <p><b>Seguridad.</b> Conexiones cifradas, contraseñas con hash, sesiones protegidas, límite de intentos de acceso y cifrado de credenciales de terceros.</p>
        <p><b>Tus derechos.</b> Puedes pedir acceso, corrección o eliminación de tus datos escribiendo a {BRAND.supportEmail}.</p>
      </div>
    </InfoPage>
  );
}
