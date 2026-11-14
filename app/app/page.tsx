import Link from "next/link";
import { eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isPro } from "@/lib/plans";
import { clp } from "@/lib/finance";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mis cursos" };

export default async function Dashboard() {
  const user = await requireUser();
  const memberOf = await db.select({ id: schema.courseMembers.courseId }).from(schema.courseMembers)
    .where(eq(schema.courseMembers.userId, user.id));
  const ids = memberOf.map((m) => m.id);
  const courses = await db.select().from(schema.courses)
    .where(ids.length ? or(eq(schema.courses.ownerId, user.id), inArray(schema.courses.id, ids)) : eq(schema.courses.ownerId, user.id))
    .orderBy(schema.courses.createdAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mis cursos</h1>
          <p className="text-sm text-muted">Cada curso tiene su propia tesorería. El Plan Pro se activa por curso.</p>
        </div>
        <Link href="/app/new" className="btn">+ Crear nuevo curso</Link>
      </div>

      {courses.length === 0 ? (
        <div className="card text-center">
          <p className="text-lg font-semibold">Aún no tienes cursos</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Crea tu primer curso con el colegio, la cuota y los meses de cobro. Te generamos un código para compartir con los apoderados.
          </p>
          <Link href="/app/new" className="btn mt-4">Crear mi primer curso</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/app/c/${c.id}`} className="card block transition hover:border-brand">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold">{c.name} · {c.year}</h2>
                  {isPro(c) && <span className="badge bg-amber-100 text-amber-900">Pro</span>}
                </div>
                <p className="text-sm text-muted">{c.school}</p>
                <p className="mt-3 text-sm">Cuota {clp(c.monthlyFee)} · {c.ownerId === user.id ? "Eres el tesorero" : "Acceso compartido"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
