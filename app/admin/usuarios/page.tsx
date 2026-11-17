import Link from "next/link";
import { count, desc, eq, ilike, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";
import { isPro } from "@/lib/plans";
import { updateUserAdmin, setUserDisabled, resetUserPassword, deleteUserAdmin } from "@/app/actions/admin";
import ActionForm from "@/components/ActionForm";
import ActionNotice from "@/components/ActionNotice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuarios" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const users = await db.select().from(schema.users)
    .where(q ? or(ilike(schema.users.email, like), ilike(schema.users.name, like)) : undefined)
    .orderBy(desc(schema.users.createdAt)).limit(60);
  const courses = users.length ? await db.select().from(schema.courses) : [];
  const [{ total }] = await db.select({ total: count() }).from(schema.users);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-bold">Usuarios</h1><p className="text-sm text-muted">{total} registrados. Edita, suspende, restablece la contraseña o elimina cuentas. Las funciones se activan por curso en “Cursos y planes”.</p></div>
        <form className="flex gap-2" role="search">
          <label className="sr-only" htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="Nombre o correo" />
          <button className="btn">Buscar</button>
        </form>
      </div>
      {users.length === 0 && <div className="card text-sm text-muted">No se encontraron usuarios.</div>}
      <ul className="space-y-3">
        {users.map((u) => {
          const mine = courses.filter((c) => c.ownerId === u.id);
          const admin = isAdminEmail(u.email);
          return (
            <li key={u.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{u.name} {admin && <span className="badge ml-1 bg-purple-100 text-purple-800">Administrador</span>} {u.disabled && <span className="badge ml-1 bg-red-100 text-red-800">Suspendido</span>}</p>
                  <p className="text-sm text-muted">{u.email} · registrado el {u.createdAt.toLocaleDateString("es-CL")}</p>
                </div>
                <p className="text-sm text-muted">{mine.length} curso(s)</p>
              </div>
              {mine.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-xs">
                  {mine.map((c) => (
                    <li key={c.id}><Link className="badge bg-slate-100 text-slate-800 hover:bg-brand-soft" href={`/admin/cursos?q=${encodeURIComponent(c.code)}`}>
                      {c.name} {c.year} · {isPro(c) ? "Pro" : "Gratis"} · funciones →</Link></li>
                  ))}
                </ul>
              )}
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-brand">Administrar usuario</summary>
                <div className="mt-3 space-y-4 rounded-xl bg-bg p-4">
                  <ActionForm action={updateUserAdmin.bind(null, u.id)} submit="Guardar datos" resetOnSuccess={false}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block"><span className="label">Nombre</span><input name="name" className="input" defaultValue={u.name} required maxLength={80} /></label>
                      <label className="block"><span className="label">Correo</span><input name="email" type="email" className="input" defaultValue={u.email} required readOnly={admin} /></label>
                    </div>
                  </ActionForm>
                  <div className="flex flex-wrap items-center gap-3">
                    {!admin && (u.disabled
                      ? <ActionNotice className="btn" label="Reactivar cuenta" action={setUserDisabled.bind(null, u.id, false)} />
                      : <ActionNotice className="btn-ghost" label="Suspender cuenta" confirm={`¿Suspender a ${u.name}? No podrá iniciar sesión hasta que la reactives.`} action={setUserDisabled.bind(null, u.id, true)} />)}
                    <ActionNotice className="btn-ghost" label="Restablecer contraseña" confirm="¿Generar una contraseña temporal? La actual dejará de servir." action={resetUserPassword.bind(null, u.id)} />
                  </div>
                  {!admin && (
                    <ActionForm action={deleteUserAdmin.bind(null, u.id)} submit="Eliminar usuario y sus cursos" submitClassName="btn-danger" resetOnSuccess={false}>
                      <p className="text-sm text-red-800">Borra para siempre su cuenta, sus cursos, alumnos, pagos y boletas. Escribe su correo para confirmar.</p>
                      <input name="confirm" className="input" autoComplete="off" placeholder={u.email} aria-label="Correo para confirmar" />
                    </ActionForm>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
