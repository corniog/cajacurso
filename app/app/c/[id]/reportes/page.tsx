import Link from "next/link";
import { requireCourse } from "@/lib/auth";
import { loadCourseData } from "@/lib/course-data";
import { hasFeature } from "@/lib/features";
import PrintButton from "@/components/PrintButton";
import ReportView from "@/components/ReportView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reportes" };

export default async function ReportsPage({ params }: PageProps<"/app/c/[id]/reportes">) {
  const { id } = await params;
  const { course } = await requireCourse(id);
  const { rows, summary } = await loadCourseData(course);
  const pro = hasFeature(course, "pdf");

  return (
    <>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Reportes financieros</h2>
          <p className="text-sm text-muted">Los números se calculan en tiempo real con lo que hay registrado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <a className="btn-ghost" href={`/api/c/${id}/export/xlsx`}>⬇ Excel</a>
          {pro
            ? <a className="btn" href={`/api/c/${id}/export/pdf`}>⬇ PDF para la reunión</a>
            : <Link className="btn-ghost" href={`/app/c/${id}/plan`} title="Disponible en Plan Pro">🔒 PDF para la reunión (Pro)</Link>}
        </div>
      </div>
      <ReportView course={course} rows={rows} summary={summary} />
    </>
  );
}
