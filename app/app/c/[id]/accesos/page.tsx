import Link from "next/link";
import { requireCourse } from "@/lib/auth";
import { appUrl, ensureStudentCodes } from "@/lib/course-data";
import { qrDataUrl } from "@/lib/qr";
import { generateDirectiveCode, revokeDirectiveCode } from "@/app/actions/pro";
import ActionButton from "@/components/ActionButton";
import CopyButton from "@/components/CopyButton";
import { isPro } from "@/lib/plans";

export const dynamic = "force-dynamic";

export const metadata = { title: "Accesos y QR" };

export default async function AccessPage({ params }: PageProps<"/app/c/[id]/accesos">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
  await ensureStudentCodes(id);
  const base = appUrl();
  const courseUrl = `${base}/c/${course.code}`;
  const dirUrl = course.directiveCode ? `${base}/d/${course.directiveCode}` : null;
  const [courseQr, dirQr] = await Promise.all([qrDataUrl(courseUrl, 220), dirUrl ? qrDataUrl(dirUrl, 220) : Promise.resolve(null)]);

  return (
    <>
      <div>
        <h2 className="text-lg font-bold">Accesos y códigos QR</h2>
        <p className="text-sm text-muted">Cada grupo entra con su propio código o QR, sin crear cuenta y sin poder modificar nada.</p>
      </div>

      <div className="card space-y-3">
        <h3 className="font-bold">👨‍👩‍👧 Apoderados: la ficha de su hijo(a)</h3>
        <p className="text-sm text-muted">
          Cada alumno tiene su propio <b>QR</b> y un <b>código corto</b> (ej: AB3D7-K9MPQ) que el apoderado escribe en la página de inicio.
          Solo ven los datos de su hijo(a). Imprime la hoja y entrégala o pégala en el cuaderno, o envía el enlace por WhatsApp desde Alumnos.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/app/c/${id}/accesos/qr`} className="btn">🖨️ Hoja de QR de todos los alumnos</Link>
          <Link href={`/app/c/${id}/alumnos`} className="btn-ghost">Ver enlaces por alumno</Link>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold">📋 Código del curso (estado general)</h3>
        <p className="mb-3 text-sm text-muted">Resumen del curso, estado de pagos con nombres abreviados y gastos. Qué se muestra lo defines en Configuración.</p>
        <div className="flex flex-wrap items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={courseQr} alt={`QR del curso ${course.name}`} width={140} height={140} className="rounded-xl border border-line" />
          <div className="space-y-2">
            <code className="rounded-lg bg-brand-soft px-3 py-2 text-base font-bold tracking-wider text-brand-dark">{course.code}</code>
            <p className="break-all text-xs text-muted">{courseUrl}</p>
            <div className="flex flex-wrap gap-2"><CopyButton text={course.code} label="Copiar código" /><CopyButton text={courseUrl} label="Copiar enlace" /></div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold">🏫 Directivos: ver todo, sin modificar</h3>
        <p className="mb-3 text-sm text-muted">
          Con este código o QR ven todos los alumnos, pagos, gastos (con boletas) e ingresos, y pueden descargar el Excel{isPro(course) ? " y el PDF" : " (el PDF se habilita con el Plan Pro)"}. No pueden editar nada.
        </p>
        {dirUrl && dirQr ? (
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dirQr} alt="QR de acceso para directivos" width={140} height={140} className="rounded-xl border border-line" />
            <div className="space-y-2">
              <code className="rounded-lg bg-blue-50 px-3 py-2 text-base font-bold tracking-wider text-blue-900">{course.directiveCode}</code>
              <p className="break-all text-xs text-muted">{dirUrl}</p>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={dirUrl} label="Copiar enlace" />
                {canWrite && <ActionButton label="Generar uno nuevo" confirm="Se desactivará el código actual y los directivos necesitarán el nuevo. ¿Continuar?" action={generateDirectiveCode.bind(null, id)} />}
                {canWrite && <ActionButton className="btn-danger" label="Desactivar acceso" confirm="¿Desactivar el acceso de directivos?" action={revokeDirectiveCode.bind(null, id)} />}
              </div>
            </div>
          </div>
        ) : canWrite ? (
          <ActionButton className="btn" label="Activar acceso para directivos" action={generateDirectiveCode.bind(null, id)} />
        ) : <p className="text-sm text-muted">Aún no está activado.</p>}
        <p className="mt-3 text-xs text-muted">Cualquiera que tenga el código puede ver los datos: compártelo solo con la directiva. Si se filtra, genera uno nuevo.</p>
      </div>
    </>
  );
}
