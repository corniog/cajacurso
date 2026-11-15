import { requireCourse } from "@/lib/auth";
import { updateCourse, deleteCourse } from "@/app/actions/course";
import ActionForm from "@/components/ActionForm";
import CourseFields from "@/components/CourseFields";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configuración" };

export default async function ConfigPage({ params }: PageProps<"/app/c/[id]/config">) {
  const { id } = await params;
  const { course, role } = await requireCourse(id);
  if (role !== "owner") {
    return <div className="card text-sm text-muted">Solo quien creó el curso puede cambiar su configuración.</div>;
  }
  return (
    <>
      <div className="card">
        <h2 className="mb-3 font-bold">Datos del curso</h2>
        <ActionForm action={updateCourse.bind(null, id)} submit="Guardar cambios" resetOnSuccess={false}>
          <CourseFields d={{
            school: course.school, name: course.name, year: course.year, monthlyFee: course.monthlyFee,
            startMonth: Math.min(...course.months), endMonth: Math.max(...course.months),
          }} />
          <fieldset className="space-y-2 rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-semibold">Qué ven los apoderados en el resumen del curso</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="publicExpenses" defaultChecked={course.publicExpenses} className="mt-1" />
              <span>Gastos e ingresos extra del curso con sus boletas (transparencia). Los totales y gráficos se muestran siempre; nunca se muestran otros alumnos.</span>
            </label>
          </fieldset>
          <p className="text-xs text-muted">
            Si cambias la cuota, se recalcula todo el año con el nuevo valor. Código del curso: <b>{course.code}</b> (no cambia).
          </p>
        </ActionForm>
      </div>

      <div className="card border-red-200">
        <h2 className="mb-1 font-bold text-red-800">Eliminar curso</h2>
        <p className="mb-3 text-sm text-muted">Borra para siempre el curso, sus alumnos, pagos, gastos y boletas. Escribe el nombre del curso (<b>{course.name}</b>) para confirmar.</p>
        <ActionForm action={deleteCourse.bind(null, id)} submit="Eliminar definitivamente" submitClassName="btn-danger">
          <input name="confirm" className="input" required autoComplete="off" />
        </ActionForm>
      </div>
    </>
  );
}
