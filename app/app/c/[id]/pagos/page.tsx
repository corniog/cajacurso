import { requireCourse } from "@/lib/auth";
import { loadCourseData, appUrl } from "@/lib/course-data";
import { hasFeature } from "@/lib/features";
import { whatsappLink } from "@/lib/util";
import { clp } from "@/lib/finance";
import PaymentGrid from "@/components/PaymentGrid";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pagos" };

export default async function PaymentsPage({ params }: PageProps<"/app/c/[id]/pagos">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
  const pro = hasFeature(course, "email");
  const base = appUrl();
  const { rows, payments } = await loadCourseData(course);
  return (
    <>
      <div>
        <h2 className="text-lg font-bold">Pagos mensuales</h2>
        <p className="text-sm text-muted">Toca una celda para registrar un pago o abono. Un mismo comprobante puede cubrir varios meses.</p>
      </div>
      <PaymentGrid
        courseId={id}
        fee={course.monthlyFee}
        months={course.months}
        canWrite={canWrite}
        students={rows.map((r) => ({
          id: r.student.id,
          name: `${r.student.lastName}, ${r.student.firstName}`,
          active: r.student.active,
          months: r.months,
          wa: whatsappLink(
            r.student.guardianPhone,
            `Hola${r.student.guardianName ? " " + r.student.guardianName.split(" ")[0] : ""}, te comparto el estado de cuenta de ${r.student.firstName} del curso ${course.name}.` +
              `${r.debt > 0 ? ` Hoy hay ${clp(r.debt)} pendiente.` : " Está al día, ¡gracias!"}\nFicha: ${base}/f/${r.student.token}\nPDF: ${base}/api/f/${r.student.token}/pdf`,
          ),
          hasEmail: !!r.student.guardianEmail,
        }))}
        pro={pro}
        payments={payments.map((p) => ({
          id: p.id, studentId: p.studentId, month: p.month, amount: p.amount,
          paidAt: p.paidAt, method: p.method, notes: p.notes,
        }))}
      />
    </>
  );
}
