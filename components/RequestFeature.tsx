import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { FEATURES, type FeatureKey } from "@/lib/features";
import { requestFeature } from "@/app/actions/support";
import ActionForm from "@/components/ActionForm";

/** Recuadro "Solicitar activación": el tesorero pide una función al administrador desde su panel. */
export default async function RequestFeature({ courseId, feature, isOwner }: { courseId: string; feature: FeatureKey; isOwner: boolean }) {
  const [last] = await db.select().from(schema.supportRequests).where(and(
    eq(schema.supportRequests.courseId, courseId), eq(schema.supportRequests.featureKey, feature))).orderBy(desc(schema.supportRequests.createdAt)).limit(1);
  if (last?.status === "pending") return <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">⏳ Solicitud enviada el {last.createdAt.toLocaleDateString("es-CL")}. El administrador la está revisando.</p>;
  return (
    <div className="space-y-2">
      {last?.status === "rejected" && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">Tu última solicitud no fue aprobada{last.adminNote ? `: “${last.adminNote}”` : "."} Puedes volver a pedirla.</p>}
      {isOwner ? (
        <ActionForm action={requestFeature.bind(null, courseId, feature)} submit={`Solicitar activación de ${FEATURES[feature].label}`} resetOnSuccess={false}>
          <label className="label" htmlFor={`rq-${feature}`}>Mensaje para el administrador (opcional)</label>
          <input id={`rq-${feature}`} name="message" className="input" maxLength={300} placeholder="Ej. Queremos que los apoderados paguen en línea" />
        </ActionForm>
      ) : <p className="text-sm text-muted">Solo quien creó el curso puede solicitarla.</p>}
    </div>
  );
}
