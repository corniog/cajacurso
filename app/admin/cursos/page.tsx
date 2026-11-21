import { desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import ActionForm from "@/components/ActionForm";
import ActionNotice from "@/components/ActionNotice";
import { deleteCourseAdmin, grantPro, setProUntil, revokePro, resetTrial, setFeatures, resetAuditCode, removeCenterLink } from "@/app/actions/admin";
import { FEATURES, FEATURE_KEYS, featureStatus, needsApproval } from "@/lib/features";

const ORIGEN = { curso: "🏫 por curso", usuario: "👤 por usuario", plan: "💳 por plan", apagada: "⛔ apagada (sin aprobar)" } as const;
import { isPro } from "@/lib/plans";
import { clp } from "@/lib/finance";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cursos y planes" };

export default async function CoursesAdminPage({ searchParams }: PageProps<"/admin/cursos">) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await db.select({ course: schema.courses, owner: schema.users }).from(schema.courses)
    .innerJoin(schema.users, eq(schema.courses.ownerId, schema.users.id))
    .where(q ? or(ilike(schema.courses.name, like), ilike(schema.courses.school, like), ilike(schema.courses.code, like), ilike(schema.users.email, like), ilike(schema.users.name, like)) : undefined)
    .orderBy(desc(schema.courses.createdAt)).limit(50);

  const links = rows.length ? await db.select({ courseId: schema.centerLinks.courseId, centerId: schema.centerLinks.centerId, name: schema.users.name, email: schema.users.email, code: schema.centerLinks.code })
    .from(schema.centerLinks).innerJoin(schema.users, eq(schema.centerLinks.centerId, schema.users.id)).where(inArray(schema.centerLinks.courseId, rows.map((r) => r.course.id))) : [];
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-bold">Cursos y planes</h1><p className="text-sm text-muted">Activa, extiende o quita el Plan Pro de cualquier curso, sin necesidad de pago.</p></div>
        <form className="flex gap-2" role="search">
          <label className="sr-only" htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="Colegio, curso, código o correo" />
          <button className="btn">Buscar</button>
        </form>
      </div>
      {rows.length === 0 && <div className="card text-sm text-muted">No se encontraron cursos.</div>}
      <ul className="space-y-3">
        {rows.map(({ course: c, owner }) => {
          const pro = isPro(c);
          return (
            <li key={c.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{c.name} · {c.year} <span className="font-normal text-muted">— {c.school}</span></p>
                  <p className="text-sm text-muted">{owner.name} · {owner.email} · cuota {clp(c.monthlyFee)} · código {c.code}</p>
                </div>
                {pro
                  ? <span className="badge bg-amber-100 text-amber-900">Pro hasta {c.proUntil!.toLocaleDateString("es-CL")}</span>
                  : <span className="badge bg-slate-100 text-slate-700">Gratis{c.proTrialUsed ? " · prueba usada" : ""}</span>}
              </div>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-brand">Administrar plan</summary>
                <div className="mt-3 grid gap-4 rounded-xl bg-bg p-4 lg:grid-cols-2">
                  <ActionForm action={grantPro.bind(null, c.id)} submit="Sumar días de Pro" resetOnSuccess={false}>
                    <p className="text-sm font-semibold">Activar / extender</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block"><span className="label">Días</span>
                        <select name="days" className="input" defaultValue="30">
                          <option value="30">30 días (1 mes)</option><option value="90">90 días</option><option value="180">180 días</option><option value="365">365 días (1 año)</option><option value="3650">10 años</option>
                        </select></label>
                      <label className="block"><span className="label">Nota</span><input name="note" className="input" maxLength={300} placeholder="Ej: cortesía" /></label>
                    </div>
                  </ActionForm>
                  <ActionForm action={setProUntil.bind(null, c.id)} submit="Fijar fecha exacta" submitClassName="btn-ghost" resetOnSuccess={false}>
                    <p className="text-sm font-semibold">Fijar fecha de término</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block"><span className="label">Hasta el</span><input name="date" type="date" required className="input" /></label>
                      <label className="block"><span className="label">Nota</span><input name="note" className="input" maxLength={300} /></label>
                    </div>
                  </ActionForm>
                  <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
                    {pro && <ActionNotice className="btn-danger" label="Quitar Pro ahora" confirm={`¿Quitar el Plan Pro de ${c.name}? Vuelve a Gratis; no se borra ningún dato.`} action={revokePro.bind(null, c.id)} />}
                    {c.proTrialUsed && <ActionNotice label="Permitir otra prueba de 30 días" action={resetTrial.bind(null, c.id)} />}
                  </div>
                </div>
              </details>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-brand">Centro de padres 🏛️ · código de auditoría</summary>
                <div className="mt-3 space-y-3 rounded-xl bg-bg p-4 text-sm">
                  <p className="text-xs text-muted">El código se creó con el curso y es fijo: el tesorero solo puede entregarlo. Solo tú puedes quitar el acceso de un centro o restablecer el código.</p>
                  <p>Código: <code className="rounded bg-blue-50 px-2 py-1 font-bold tracking-wider text-blue-900">{c.auditCode ?? "—"}</code></p>
                  {(() => {
                    const mine = links.filter((l) => l.courseId === c.id);
                    return mine.length === 0 ? <p className="text-muted">Ningún centro de padres lo ha agregado.</p> : (
                      <ul className="divide-y divide-line rounded-xl border border-line bg-white">
                        {mine.map((l) => (
                          <li key={l.centerId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <span><b>{l.name}</b> <span className="text-muted">{l.email}</span>{l.code !== c.auditCode && <span className="ml-2 text-xs text-amber-700">(código antiguo, sin acceso)</span>}</span>
                            <ActionNotice className="btn-danger !px-2.5 !py-1 text-xs" label="Quitar acceso" confirm={`¿Quitar el acceso de ${l.name} a ${c.name}?`} action={removeCenterLink.bind(null, c.id, l.centerId)} />
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                  <ActionNotice className="btn-ghost" label="Restablecer código" confirm="Se creará un código nuevo y TODOS los centros de padres vinculados perderán el acceso. ¿Continuar?" action={resetAuditCode.bind(null, c.id)} />
                </div>
              </details>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-brand">
                  Funciones del curso{Object.keys(c.features ?? {}).length ? ` · ${Object.keys(c.features).length} con ajuste manual` : ""}
                </summary>
                <div className="mt-3 rounded-xl bg-bg p-4">
                  <p className="mb-3 text-xs text-muted">Ajuste solo para ESTE curso; tiene prioridad sobre el del usuario. «Sin ajuste de curso» deja decidir al usuario dueño o al plan. «Activada» la habilita aunque el curso sea gratis; «Desactivada» la bloquea aunque tenga Pro.</p>
                  <ActionForm action={setFeatures.bind(null, c.id)} submit="Guardar funciones" resetOnSuccess={false}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {FEATURE_KEYS.map((k) => {
                        const o = c.features?.[k];
                        const st = featureStatus(c, k);
                        return (
                          <label key={k} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-white p-3 text-sm">
                            <span><b>{FEATURES[k].label}</b><br /><span className="text-xs text-muted">{FEATURES[k].desc} · hoy: {st.on ? "✅ disponible" : "🔒 bloqueada"} · origen: <b>{ORIGEN[st.source]}</b></span></span>
                            <select name={k} defaultValue={o === true ? "on" : o === false ? "off" : "plan"} className="input !w-auto !py-1.5 text-xs">
                              <option value="plan">{needsApproval(k) ? "Sin ajuste de curso (usuario o apagada)" : "Sin ajuste de curso (usuario o plan)"}</option><option value="on">Activada</option><option value="off">Desactivada</option>
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  </ActionForm>
                </div>
              </details>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-red-700">Eliminar curso</summary>
                <div className="mt-3 rounded-xl bg-bg p-4">
                  <ActionForm action={deleteCourseAdmin.bind(null, c.id)} submit="Eliminar curso para siempre" submitClassName="btn-danger" resetOnSuccess={false}>
                    <p className="text-sm text-red-800">Borra el curso, sus alumnos, pagos, gastos y boletas. Escribe el nombre del curso (<b>{c.name}</b>) para confirmar.</p>
                    <input name="confirm" className="input" autoComplete="off" aria-label="Nombre del curso para confirmar" />
                  </ActionForm>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">Se muestran hasta 50 resultados. Usa el buscador para encontrar un curso específico.</p>
    </>
  );
}
