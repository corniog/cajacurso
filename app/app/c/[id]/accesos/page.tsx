import Link from "next/link";
import { requireCourse } from "@/lib/auth";
import { appUrl, ensureStudentCodes } from "@/lib/course-data";
import { qrDataUrl } from "@/lib/qr";
import { generateDirectiveCode, revokeDirectiveCode } from "@/app/actions/pro";
import { generateAuditCode, revokeAuditCode } from "@/app/actions/center";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import ActionButton from "@/components/ActionButton";
import CopyButton from "@/components/CopyButton";
import { hasFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

export const metadata = { title: "Accesos y QR" };

export default async function AccessPage({ params }: PageProps<"/app/c/[id]/accesos">) {
  const { id } = await params;
  const { course, canWrite, role } = await requireCourse(id);
  await ensureStudentCodes(id);
  const base = appUrl();
  const courseUrl = `${base}/c/${course.code}`;
  const dirUrl = course.directiveCode ? `${base}/d/${course.directiveCode}` : null;
  const centers = course.auditCode
    ? await db.select({ name: schema.users.name, school: schema.users.centerSchool }).from(schema.centerLinks)
      .innerJoin(schema.users, eq(schema.centerLinks.centerId, schema.users.id))
      .where(and(eq(schema.centerLinks.courseId, id), eq(schema.centerLinks.code, course.auditCode)))
    : [];
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
        <h3 className="font-bold">📋 Código del curso (resumen para apoderados)</h3>
        <p className="mb-3 text-sm text-muted">Resumen con totales, porcentajes y gráficos, sin nombres ni pagos de alumnos. Los gastos con boleta se muestran si lo activas en Configuración.</p>
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
          Con este código o QR ven todos los alumnos, pagos, gastos (con boletas) e ingresos, y pueden descargar el Excel{hasFeature(course, "pdf") ? " y el PDF" : " (el PDF se habilita con el Plan Pro)"}. No pueden editar nada.
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

      <div className="card">
        <h3 className="font-bold">🏛️ Centro de padres: auditoría del curso</h3>
        <p className="mb-3 text-sm text-muted">
          Si el centro de padres de tu colegio te lo pide, entrégale este código. Con él agrega el curso a su cuenta y ve el resumen, el libro contable (con descarga en Excel y PDF) y los gastos con boleta; los alumnos aparecen abreviados. <b>No puede editar nada.</b> Solo funciona con centros de padres de {course.school} activados por el administrador.
        </p>
        {course.auditCode ? (
          <div className="space-y-3">
            <code className="inline-block rounded-lg bg-blue-50 px-3 py-2 text-base font-bold tracking-wider text-blue-900">{course.auditCode}</code>
            <p className="text-sm">{centers.length ? <>Centros con acceso: <b>{centers.map((c) => c.name).join(", ")}</b></> : <span className="text-muted">Ningún centro lo ha agregado todavía.</span>}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={course.auditCode} label="Copiar código" />
              {canWrite && role === "owner" && <ActionButton label="Generar uno nuevo" confirm="El código actual dejará de funcionar y los centros ya vinculados perderán el acceso hasta que agreguen el nuevo. ¿Continuar?" action={generateAuditCode.bind(null, id)} />}
              {canWrite && role === "owner" && <ActionButton className="btn-danger" label="Desactivar acceso" confirm="¿Quitar el acceso al centro de padres?" action={revokeAuditCode.bind(null, id)} />}
            </div>
          </div>
        ) : canWrite && role === "owner" ? (
          <ActionButton className="btn" label="Generar código para el centro de padres" action={generateAuditCode.bind(null, id)} />
        ) : <p className="text-sm text-muted">Aún no está activado.</p>}
        <p className="mt-3 text-xs text-muted">Comparte el código solo con el centro de padres. Si se filtra, genera uno nuevo: el acceso anterior se corta de inmediato.</p>
      </div>
    </>
  );
}
