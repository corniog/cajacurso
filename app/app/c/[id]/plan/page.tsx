import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { isPro } from "@/lib/plans";
import { hasFeature } from "@/lib/features";
import { BRAND, PLANS } from "@/lib/brand";
import { clp } from "@/lib/finance";
import { platformMpConfigured } from "@/lib/mp";
import { driveConfigured } from "@/lib/drive";
import { mailConfigured } from "@/lib/mail";
import ActionForm from "@/components/ActionForm";
import ActionButton from "@/components/ActionButton";
import { startTrialAction, subscribe, saveMpToken, removeMpToken, disconnectDriveAction, saveReminders, sendRemindersNow, addMember, removeMember, requestManualPlan, cancelManualRequest } from "@/app/actions/pro";

export const dynamic = "force-dynamic";

export const metadata = { title: "Plan e integraciones" };

export default async function PlanPage({ params, searchParams }: PageProps<"/app/c/[id]/plan">) {
  const { id } = await params;
  const sp = await searchParams;
  const { course, role } = await requireCourse(id);
  const pro = isPro(course);
  const isOwner = role === "owner";
  const [integ] = await db.select().from(schema.integrations).where(eq(schema.integrations.courseId, id)).limit(1);
  const members = await db.select({ userId: schema.courseMembers.userId, role: schema.courseMembers.role, name: schema.users.name, email: schema.users.email })
    .from(schema.courseMembers).innerJoin(schema.users, eq(schema.courseMembers.userId, schema.users.id))
    .where(eq(schema.courseMembers.courseId, id));
  const [pendingReq] = await db.select().from(schema.subscriptions)
    .where(and(eq(schema.subscriptions.courseId, id), eq(schema.subscriptions.status, "pending"), eq(schema.subscriptions.method, "transferencia"))).limit(1);
  const transferInfo = (process.env.TRANSFER_INFO ?? "").replace(/\\n/g, "\n").trim();
  const until = course.proUntil?.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      {sp.pago === "ok" && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Recibimos tu pago. El Plan Pro se activa en cuanto Mercado Pago lo confirme (normalmente al instante).</p>}
      {sp.pago === "error" && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">El pago no se completó. Puedes intentarlo de nuevo.</p>}
      {sp.drive === "ok" && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Google Drive conectado.</p>}
      {sp.drive === "error" && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">No se pudo conectar Google Drive. Inténtalo otra vez.</p>}

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{pro ? "Plan Pro activo" : "Plan Gratis"}</h2>
            <p className="text-sm text-muted">{pro ? `Vigente hasta el ${until}.` : "Alumnos, pagos, gastos, ficha y reportes sin costo. El Pro suma integraciones y extras sin tope."}</p>
          </div>
          <span className={`badge ${pro ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{pro ? "Pro" : "Gratis"}</span>
        </div>
        {isOwner ? (
          <div className="space-y-4">
            {!course.proTrialUsed && !pro && (
              <ActionForm action={async () => { "use server"; return startTrialAction(id); }} submit={`Probar Pro ${PLANS.trialDays} días gratis`} resetOnSuccess={false}><span /></ActionForm>
            )}
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{pro ? "Renovar o extender" : "Elige cómo pagar"}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-line p-4">
                <h4 className="font-bold">💳 Pagar en línea (Mercado Pago)</h4>
                <p className="text-sm text-muted">El plan se activa solo en cuanto se confirma el pago.</p>
                {platformMpConfigured() ? (
                  <div className="flex flex-wrap gap-2">
                    {(["monthly", "annual"] as const).map((p) => (
                      <ActionForm key={p} action={async () => { "use server"; return subscribe(id, p); }} submit={`${PLANS[p].label} · ${clp(PLANS[p].price)}`} submitClassName={p === "annual" ? "btn" : "btn-ghost"} resetOnSuccess={false}><span /></ActionForm>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted">El pago en línea aún no está disponible. Puedes usar la transferencia.</p>}
              </div>
              <div className="space-y-3 rounded-xl border border-line p-4">
                <h4 className="font-bold">🏦 Transferencia bancaria</h4>
                {transferInfo
                  ? <pre className="whitespace-pre-wrap rounded-lg bg-bg p-3 font-sans text-sm">{transferInfo}</pre>
                  : <p className="text-sm text-muted">Escríbenos a <a className="font-semibold text-brand" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> para coordinar el pago.</p>}
                {pendingReq ? (
                  <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <p><b>Solicitud pendiente:</b> {pendingReq.plan === "annual" ? PLANS.annual.label : PLANS.monthly.label} ({clp(pendingReq.amount)}). Cuando confirmemos tu transferencia, el plan se activa.</p>
                    <ActionButton className="btn-ghost !py-1.5" label="Cancelar solicitud" confirm="¿Cancelar la solicitud?" action={cancelManualRequest.bind(null, id)} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted">Después de transferir, avísanos aquí para activar el plan:</p>
                    {(["monthly", "annual"] as const).map((p) => (
                      <ActionForm key={p} action={requestManualPlan.bind(null, id, p)} submit={`Ya transferí · ${PLANS[p].label} ${clp(PLANS[p].price)}`} submitClassName={p === "annual" ? "btn" : "btn-ghost"} resetOnSuccess={false}>
                        <input name="note" className="input" maxLength={300} placeholder="N° de operación o comentario (opcional)" aria-label={`Comentario ${PLANS[p].label}`} />
                      </ActionForm>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : <p className="text-sm text-muted">Solo quien creó el curso puede cambiar el plan.</p>}
        <p className="text-xs text-muted">Un pago extiende la vigencia desde el vencimiento actual. El Pro se activa solo en este curso.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="font-bold">Mercado Pago en la ficha</h3>
          <p className="text-sm text-muted">Los apoderados pagan en línea y el pago queda registrado solo. El dinero llega a <b>tu</b> cuenta de Mercado Pago.</p>
          {integ?.mpAccessToken ? (
            <div className="flex items-center justify-between gap-3">
              <span className="badge bg-emerald-100 text-emerald-900">Conectado</span>
              {isOwner && <ActionButton className="btn-danger" label="Desconectar" confirm="¿Desconectar Mercado Pago?" action={removeMpToken.bind(null, id)} />}
            </div>
          ) : isOwner && hasFeature(course, "mercadopago") ? (
            <ActionForm action={saveMpToken.bind(null, id)} submit="Conectar">
              <label className="label" htmlFor="mp">Access Token de producción</label>
              <input id="mp" name="token" type="password" className="input" autoComplete="off" placeholder="APP_USR-…" />
              <p className="text-xs text-muted">
                En <b>mercadopago.cl/developers</b> → <b>Tus integraciones</b> → crea una aplicación (Checkout Pro) → <b>Credenciales</b> → elige <b>Producción</b> (si es la primera vez, pulsa “Activar ambiente de producción”) y copia el <b>Access Token</b>. Se guarda cifrado.
              </p>
            </ActionForm>
          ) : <p className="text-sm text-muted">Disponible en Plan Pro.</p>}
        </div>

        <div className="card space-y-3">
          <h3 className="font-bold">Google Drive para boletas</h3>
          <p className="text-sm text-muted">Cada boleta que subas también se guarda en una carpeta de tu Drive. La app solo ve lo que ella misma crea.</p>
          {integ?.driveRefreshToken ? (
            <div className="flex items-center justify-between gap-3">
              <span className="badge bg-emerald-100 text-emerald-900">Conectado</span>
              {isOwner && <ActionButton className="btn-danger" label="Desconectar" confirm="¿Desconectar Google Drive?" action={disconnectDriveAction.bind(null, id)} />}
            </div>
          ) : isOwner && hasFeature(course, "drive") ? (
            driveConfigured()
              ? <a className="btn" href={`/api/integrations/drive/start?course=${id}`}>Conectar Google Drive</a>
              : <p className="text-sm text-muted">Google Drive aún no está configurado en esta plataforma.</p>
          ) : <p className="text-sm text-muted">Disponible en Plan Pro.</p>}
        </div>

        <div className="card space-y-3">
          <h3 className="font-bold">Correos y recordatorios</h3>
          <p className="text-sm text-muted">Aviso al apoderado cuando registras un pago y recordatorio mensual de deuda.</p>
          {!mailConfigured() && <p className="text-xs text-amber-700">El envío de correos aún no está configurado en esta plataforma (SMTP).</p>}
          {isOwner && hasFeature(course, "reminders") ? (
            <>
              <ActionForm action={saveReminders.bind(null, id)} submit="Guardar" resetOnSuccess={false}>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={integ?.remindersEnabled} /> Enviar recordatorio automático cada mes</label>
                <div><label className="label" htmlFor="rd">Día del mes</label><input id="rd" name="reminderDay" type="number" min={1} max={28} defaultValue={integ?.reminderDay ?? 5} className="input !w-24" /></div>
              </ActionForm>
              <ActionForm action={async () => { "use server"; return sendRemindersNow(id); }} submit="Enviar recordatorios ahora" submitClassName="btn-ghost" resetOnSuccess={false}><span /></ActionForm>
            </>
          ) : <p className="text-sm text-muted">Disponible en Plan Pro.</p>}
        </div>

        <div className="card space-y-3">
          <h3 className="font-bold">Co-tesorero</h3>
          <p className="text-sm text-muted">Un curso puede tener dos tesoreros: tú y un co-tesorero(a). Puede registrar pagos, gastos y enviar correos; no puede cambiar el plan ni eliminar el curso. Debe tener cuenta en la plataforma.</p>
          {members.length > 0 && (
            <ul className="divide-y divide-line text-sm">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2 py-2">
                  <span>{m.name} <span className="text-muted">· {m.email}</span></span>
                  {isOwner && <ActionButton className="btn-danger !px-2 !py-1" label="Quitar" confirm="¿Quitar el acceso del co-tesorero?" action={removeMember.bind(null, id, m.userId)} />}
                </li>
              ))}
            </ul>
          )}
          {isOwner && hasFeature(course, "coTreasurer") && members.length === 0 ? (
            <ActionForm action={addMember.bind(null, id)} submit="Agregar co-tesorero">
              <input name="email" type="email" required className="input" placeholder="correo@ejemplo.cl" aria-label="Correo del co-tesorero" />
            </ActionForm>
          ) : members.length > 0 ? null : <p className="text-sm text-muted">Disponible en Plan Pro.</p>}
        </div>
      </div>
    </>
  );
}
