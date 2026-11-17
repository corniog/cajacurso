import type { Course } from "@/lib/db/schema";

/** Funciones del Plan Pro. El administrador puede activar o desactivar cada una por curso, sin importar el plan. */
export const FEATURES = {
  email: { label: "Correos con PDF a apoderados", desc: "Envío del estado de cuenta en PDF y avisos de pago por correo" },
  reminders: { label: "Recordatorios mensuales", desc: "Recordatorio automático de deuda por correo" },
  drive: { label: "Respaldo en Google Drive", desc: "Copia de cada boleta en el Drive del tesorero" },
  mercadopago: { label: "Pago en línea (Mercado Pago)", desc: "Los apoderados pagan desde su ficha" },
  pdf: { label: "PDF para reunión y directivos", desc: "Descarga del reporte en PDF" },
  extras: { label: "Ingresos extra ilimitados", desc: "Sin tope de ingresos extra" },
  coTreasurer: { label: "Co-tesorero", desc: "Segundo tesorero con acceso de escritura" },
  contributions: { label: "Aportes y colectas", desc: "Cobros distintos de la cuota (regalo, venta, compras) que los apoderados pagan o informan desde su ficha" },
  events: { label: "Ventas para eventos", desc: "Punto de venta con productos, boletas, fiado y presupuestos" },
} as const;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

/** Valor explícito del administrador (si existe) o, si no, lo que da el plan. */
export function hasFeature(course: Pick<Course, "proUntil" | "features">, key: FeatureKey): boolean {
  const o = course.features?.[key];
  if (o === true) return true;
  if (o === false) return false;
  return !!course.proUntil && course.proUntil.getTime() > Date.now();
}
