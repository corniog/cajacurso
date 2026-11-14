import "server-only";
import { Readable } from "node:stream";
import { drive as driveApi, auth as googleAuth } from "@googleapis/drive";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course } from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { isPro } from "@/lib/plans";

const SCOPE = ["https://www.googleapis.com/auth/drive.file"]; // solo accede a archivos creados por la app

export const driveConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

function oauth() {
  return new googleAuth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/integrations/drive/callback`,
  );
}

export function driveAuthUrl(courseId: string, state: string) {
  return oauth().generateAuthUrl({
    access_type: "offline", prompt: "consent", scope: SCOPE, state: `${courseId}.${state}`,
  });
}

export async function connectDrive(courseId: string, code: string, courseName: string) {
  const client = oauth();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error("Google no entregó permiso de acceso continuo. Vuelve a intentarlo.");
  client.setCredentials(tokens);
  const drive = driveApi({ version: "v3", auth: client });
  const folder = await drive.files.create({
    requestBody: { name: `Boletas · ${courseName}`, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  const values = {
    driveRefreshToken: encrypt(tokens.refresh_token),
    driveFolderId: folder.data.id ?? null,
    updatedAt: new Date(),
  };
  await db.insert(schema.integrations).values({ courseId, ...values })
    .onConflictDoUpdate({ target: schema.integrations.courseId, set: values });
}

export async function disconnectDrive(courseId: string) {
  await db.update(schema.integrations).set({ driveRefreshToken: null, driveFolderId: null, updatedAt: new Date() })
    .where(eq(schema.integrations.courseId, courseId));
}

/** Sube la boleta a la carpeta Drive del curso (solo Plan Pro). Nunca bloquea el registro del gasto. */
export async function uploadReceiptToDrive(
  course: Course, fileName: string, mime: string, data: Buffer, label: string,
): Promise<string | null> {
  try {
    if (!isPro(course) || !driveConfigured()) return null;
    const [i] = await db.select().from(schema.integrations).where(eq(schema.integrations.courseId, course.id)).limit(1);
    if (!i?.driveRefreshToken || !i.driveFolderId) return null;
    const client = oauth();
    client.setCredentials({ refresh_token: decrypt(i.driveRefreshToken) });
    const drive = driveApi({ version: "v3", auth: client });
    const ext = fileName.slice(fileName.lastIndexOf("."));
    const res = await drive.files.create({
      requestBody: { name: `${label.slice(0, 80)}${ext}`, parents: [i.driveFolderId] },
      media: { mimeType: mime, body: Readable.from(data) },
      fields: "id",
    });
    return res.data.id ?? null;
  } catch (e) {
    console.error("[drive] no se pudo subir la boleta:", e instanceof Error ? e.message : e);
    return null;
  }
}
