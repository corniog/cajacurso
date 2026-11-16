import Link from "next/link";
import { FEATURES, type FeatureKey } from "@/lib/features";

/** Aviso cuando la función no está activa en el curso. */
export default function FeatureLock({ courseId, feature }: { courseId: string; feature: FeatureKey }) {
  return (
    <div className="card space-y-2">
      <h2 className="text-lg font-bold">🔒 {FEATURES[feature].label}</h2>
      <p className="text-sm text-muted">{FEATURES[feature].desc}. Esta función es parte del Plan Pro.</p>
      <Link href={`/app/c/${courseId}/plan`} className="btn inline-block">Ver Plan Pro (30 días de prueba)</Link>
    </div>
  );
}
