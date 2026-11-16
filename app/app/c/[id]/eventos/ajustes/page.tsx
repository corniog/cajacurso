/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireCourse } from "@/lib/auth";
import { hasFeature } from "@/lib/features";
import { saveEventSettings } from "@/app/actions/events";
import { loadSettings } from "@/lib/events";
import ActionForm from "@/components/ActionForm";
import FeatureLock from "@/components/FeatureLock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Datos del negocio" };

export default async function AjustesEventosPage({ params }: PageProps<"/app/c/[id]/eventos/ajustes">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
  if (!hasFeature(course, "events")) return <FeatureLock courseId={id} feature="events" />;
  const s = await loadSettings(course);
  return (
    <>
      <div>
        <Link href={`/app/c/${id}/eventos`} className="text-sm text-brand">← Eventos</Link>
        <h2 className="text-lg font-bold">Datos y logo de las boletas</h2>
        <p className="text-sm text-muted">Aparecen en la parte superior de cada boleta, PDF y enlace.</p>
      </div>
      {canWrite ? (
        <div className="card max-w-xl">
          <ActionForm action={saveEventSettings.bind(null, id)} submit="Guardar" resetOnSuccess={false}>
            <div><label className="label" htmlFor="b-name">Nombre que aparece en la boleta</label><input id="b-name" name="businessName" className="input" defaultValue={s.businessName} maxLength={80} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="b-phone">Teléfono</label><input id="b-phone" name="phone" className="input" defaultValue={s.phone} /></div>
              <div><label className="label" htmlFor="b-mail">Correo</label><input id="b-mail" name="email" type="email" className="input" defaultValue={s.email} /></div>
            </div>
            <div><label className="label" htmlFor="b-addr">Dirección o colegio</label><input id="b-addr" name="address" className="input" defaultValue={s.address} maxLength={120} /></div>
            <div><label className="label" htmlFor="b-foot">Mensaje al pie</label><input id="b-foot" name="footer" className="input" defaultValue={s.footer} maxLength={120} /></div>
            <div>
              <label className="label" htmlFor="b-logo">Logo (PNG o JPG, máx. 60 KB)</label>
              {s.logo && <img src={s.logo} alt="Logo actual" className="mb-2 h-16 w-16 object-contain" />}
              <input id="b-logo" name="logoFile" type="file" accept="image/png,image/jpeg" className="input" />
              {s.logo && <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" name="removeLogo" /> Quitar logo</label>}
            </div>
          </ActionForm>
        </div>
      ) : <p className="text-sm text-muted">Tu rol es de solo lectura.</p>}
    </>
  );
}
