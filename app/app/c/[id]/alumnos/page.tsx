import { requireCourse } from "@/lib/auth";
import { loadCourseData, appUrl, ensureStudentCodes } from "@/lib/course-data";
import { addStudent, updateStudent, importStudents, setStudentActive, deleteStudent } from "@/app/actions/course";
import ActionForm from "@/components/ActionForm";
import ActionButton from "@/components/ActionButton";
import CopyButton from "@/components/CopyButton";
import { MONTH_NAMES, clp } from "@/lib/finance";
import { whatsappLink } from "@/lib/util";
import { isPro } from "@/lib/plans";
import { sendStatementOne, sendStatementsAll } from "@/app/actions/pro";
import ActionNotice from "@/components/ActionNotice";
import type { Student, Course } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export const metadata = { title: "Alumnos" };

function StudentFields({ s, course }: { s?: Student; course: Course }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Nombre</span><input name="firstName" className="input" required defaultValue={s?.firstName} /></label>
        <label className="block"><span className="label">Apellido</span><input name="lastName" className="input" required defaultValue={s?.lastName} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">RUT (opcional)</span><input name="rut" className="input" defaultValue={s?.rut ?? ""} placeholder="12.345.678-5" /></label>
        <label className="block"><span className="label">Apoderado (opcional)</span><input name="guardianName" className="input" defaultValue={s?.guardianName ?? ""} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Teléfono (WhatsApp)</span><input name="guardianPhone" className="input" defaultValue={s?.guardianPhone ?? ""} placeholder="9 1234 5678" /></label>
        <label className="block"><span className="label">Correo del apoderado</span><input name="guardianEmail" type="email" className="input" defaultValue={s?.guardianEmail ?? ""} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Cobrar desde</span><select name="billingStart" className="input" defaultValue={s?.billingStart ?? ""}>
            <option value="">Inicio del curso</option>
            {course.months.map((m) => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
          </select></label>
        <label className="block"><span className="label">Cobrar hasta</span><select name="billingEnd" className="input" defaultValue={s?.billingEnd ?? ""}>
            <option value="">Fin del curso</option>
            {course.months.map((m) => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
          </select></label>
      </div>
    </>
  );
}

export default async function StudentsPage({ params }: PageProps<"/app/c/[id]/alumnos">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
  await ensureStudentCodes(id);
  const { rows } = await loadCourseData(course);
  const base = appUrl();
  const pro = isPro(course);

  return (
    <>
      {canWrite && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-3 font-bold">Agregar alumno</h2>
            <ActionForm action={addStudent.bind(null, id)} submit="Agregar alumno"><StudentFields course={course} /></ActionForm>
          </div>
          <div className="card">
            <h2 className="mb-1 font-bold">Importar desde planilla</h2>
            <p className="mb-3 text-sm text-muted">
              Sube un Excel (.xlsx) o CSV. La primera fila debe tener los títulos: <b>Nombre, Apellido</b> y, si quieres, <b>RUT, Apoderado, Teléfono, Correo</b>.
              Los alumnos repetidos se omiten.
            </p>
            <ActionForm action={importStudents.bind(null, id)} submit="Importar alumnos">
              <input type="file" name="file" accept=".xlsx,.csv" required className="input" />
            </ActionForm>
          </div>
        </div>
      )}

      <div className="card !p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
          <h2 className="font-bold">Alumnos ({rows.length})</h2>
          {canWrite && pro && (
            <ActionNotice label="✉️ Enviar estado de cuenta (PDF) a todos" confirm="Se enviará un correo con el PDF a cada apoderado que tenga correo registrado. ¿Continuar?" action={sendStatementsAll.bind(null, id)} />
          )}
        </div>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">Agrega a tu primer alumno o importa la lista del curso.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const s = r.student;
              const ficha = `${base}/f/${s.token}`;
              const msg = `Hola${s.guardianName ? " " + s.guardianName.split(" ")[0] : ""}, te comparto la ficha de pagos de ${s.firstName} del curso ${course.name}: ${ficha}`;
              const wa = whatsappLink(s.guardianPhone, msg);
              return (
                <li key={s.id} className={`px-5 py-3 ${s.active ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{s.lastName}, {s.firstName} {!s.active && <span className="badge bg-slate-100 text-slate-600">Inactivo</span>}</p>
                      <p className="text-xs text-muted">
                        {[s.guardianName, s.guardianPhone, s.rut].filter(Boolean).join(" · ") || "Sin datos del apoderado"}
                        {s.shortCode && <> · Código <span className="font-mono font-semibold">{s.shortCode}</span></>}
                        {" · "}{r.debt > 0 ? <span className="font-semibold text-red-700">Debe {clp(r.debt)}</span> : <span className="text-emerald-700">Al día</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyButton text={ficha} label="Copiar ficha" />
                      {canWrite && pro && s.guardianEmail && (
                        <ActionNotice label="✉️ Enviar PDF" action={sendStatementOne.bind(null, id, s.id)} />
                      )}
                      {wa && <a className="btn-ghost !px-3 !py-1.5" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                    </div>
                  </div>
                  {canWrite && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-brand">Editar</summary>
                      <div className="mt-3 space-y-3 rounded-xl bg-bg p-4">
                        <ActionForm action={updateStudent.bind(null, id, s.id)} submit="Guardar cambios" resetOnSuccess={false}>
                          <StudentFields s={s} course={course} />
                        </ActionForm>
                        <div className="flex flex-wrap gap-2">
                          <ActionButton label={s.active ? "Desactivar (se retiró)" : "Reactivar"} action={setStudentActive.bind(null, id, s.id, !s.active)} />
                          <ActionButton className="btn-danger" label="Eliminar con su historial"
                            confirm={`¿Eliminar a ${s.firstName} ${s.lastName} y todos sus pagos? Esto no se puede deshacer. Si solo se retiró, mejor desactívalo.`}
                            action={deleteStudent.bind(null, id, s.id)} />
                        </div>
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
