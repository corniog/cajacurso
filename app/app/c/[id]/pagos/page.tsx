import { requireCourse } from "@/lib/auth";
import { loadCourseData } from "@/lib/course-data";
import PaymentGrid from "@/components/PaymentGrid";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pagos" };

export default async function PaymentsPage({ params }: PageProps<"/app/c/[id]/pagos">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
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
        }))}
        payments={payments.map((p) => ({
          id: p.id, studentId: p.studentId, month: p.month, amount: p.amount,
          paidAt: p.paidAt, method: p.method, notes: p.notes,
        }))}
      />
    </>
  );
}
