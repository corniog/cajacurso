import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { appUrl, ensureStudentCodes } from "@/lib/course-data";
import { qrDataUrl } from "@/lib/qr";
import PrintButton from "@/components/PrintButton";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = { title: "Hoja de QR" };

export default async function QrSheetPage({ params }: PageProps<"/app/c/[id]/accesos/qr">) {
  const { id } = await params;
  const { course } = await requireCourse(id);
  await ensureStudentCodes(id);
  const students = (await db.select().from(schema.students).where(eq(schema.students.courseId, id))
    .orderBy(asc(schema.students.lastName), asc(schema.students.firstName))).filter((s) => s.active);
  const base = appUrl();
  const host = base.replace(/^https?:\/\//, "");
  const qrs = await Promise.all(students.map((s) => qrDataUrl(`${base}/f/${s.token}`, 260)));

  return (
    <>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Hoja de QR por alumno</h2>
          <p className="text-sm text-muted">Imprímela y recorta cada tarjeta. Cada QR lleva solo a la ficha de ese alumno.</p>
        </div>
        <PrintButton />
      </div>
      {students.length === 0 && <p className="card text-sm text-muted">Aún no hay alumnos activos.</p>}
      <div className="grid grid-cols-2 gap-3 print:gap-2 lg:grid-cols-3">
        {students.map((s, i) => (
          <div key={s.id} className="break-inside-avoid rounded-2xl border border-dashed border-slate-400 bg-white p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{course.school} · {course.name} {course.year}</p>
            <p className="mt-1 text-base font-bold">{s.firstName} {s.lastName}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrs[i]} alt={`QR de ${s.firstName} ${s.lastName}`} width={150} height={150} className="mx-auto my-2" />
            <p className="text-xs text-muted">Escanea o entra a <b>{host}</b> e ingresa el código:</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-widest">{s.shortCode}</p>
            <p className="mt-1 text-[10px] text-muted">{BRAND.name}</p>
          </div>
        ))}
      </div>
    </>
  );
}
