import type { Course } from "@/lib/db/schema";

/** Funciones del Plan Pro. El administrador puede activar o desactivar cada una por curso, sin importar el plan. */
export const FEATURES = {
  email: { label: "Correos con PDF a apoderados", desc: "Envío del estado de cuenta en PDF y avisos de pago por correo" },
  reminders: { label: "Recordatorios mensuales", desc: "Recordatorio automático de deuda por correo" },
  drive: { label: "Respaldo en Google Drive", desc: "Copia de cada boleta en el Drive del tesorero" },
  mercadopago: { label: "Pago en línea (Mercado Pago)", desc: "Los apoderados pagan desde su ficha. Mercado Pago cobra comisión al tesorero", needsApproval: true },
  pdf: { label: "PDF para reunión y directivos", desc: "Descarga del reporte en PDF" },
  extras: { label: "Ingresos extra ilimitados", desc: "Sin tope de ingresos extra" },
  coTreasurer: { label: "Co-tesorero", desc: "Segundo tesorero con acceso de escritura" },
  contributions: { label: "Aportes y colectas", desc: "Cobros distintos de la cuota (regalo, venta, compras) que los apoderados pagan o informan desde su ficha" },
  events: { label: "Ventas para eventos", desc: "Punto de venta con productos, boletas, fiado y presupuestos" },
} as const satisfies Record<string, { label: string; desc: string; needsApproval?: boolean }>;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

/** Funciones que el plan NO incluye: solo se activan si el administrador las aprueba (o las otorga) para ese curso. */
export const needsApproval = (key: FeatureKey) => "needsApproval" in FEATURES[key];

export type FeatureSource = "curso" | "usuario" | "plan" | "apagada";
type FeatureCourse = Pick<Course, "proUntil" | "features" | "ownerFeatures">;

/**
 * Orden de prioridad: 1) lo que el administrador fijó para ESE curso, 2) lo que fijó para el USUARIO dueño
 * (vale para todos sus cursos, también los que cree después), 3) lo que da el plan.
 */
export function featureStatus(course: FeatureCourse, key: FeatureKey): { on: boolean; source: FeatureSource } {
  const c = course.features?.[key];
  if (c === true || c === false) return { on: c, source: "curso" };
  const u = course.ownerFeatures?.[key];
  if (u === true || u === false) return { on: u, source: "usuario" };
  if (needsApproval(key)) return { on: false, source: "apagada" };
  return { on: !!course.proUntil && course.proUntil.getTime() > Date.now(), source: "plan" };
}

export const hasFeature = (course: FeatureCourse, key: FeatureKey) => featureStatus(course, key).on;
