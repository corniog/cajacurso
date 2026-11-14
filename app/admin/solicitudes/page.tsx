import AdminRequests from "@/components/AdminRequests";

export const metadata = { title: "Solicitudes" };

export default function RequestsPage() {
  return (
    <>
      <div><h1 className="text-xl font-bold">Solicitudes por transferencia</h1><p className="text-sm text-muted">Revisa tu cuenta bancaria; cuando llegue el dinero, aprueba y el plan se activa al instante.</p></div>
      <AdminRequests />
    </>
  );
}
