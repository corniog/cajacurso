import AdminRequests from "@/components/AdminRequests";
import SupportRequests from "@/components/SupportRequests";

export const dynamic = "force-dynamic";

export const metadata = { title: "Solicitudes" };

export default function RequestsPage() {
  return (
    <>
      <div><h1 className="text-xl font-bold">Solicitudes de usuarios</h1><p className="text-sm text-muted">Funciones que piden los tesoreros y mensajes enviados desde la aplicación. Al aprobar una función, se activa en ese curso al instante.</p></div>
      <SupportRequests />
      <div><h2 className="text-lg font-bold">Solicitudes de plan por transferencia</h2><p className="text-sm text-muted">Revisa tu cuenta bancaria; cuando llegue el dinero, aprueba y el plan se activa al instante.</p></div>
      <AdminRequests />
    </>
  );
}
