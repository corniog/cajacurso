import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Comprobación optimista: si no hay cookie de sesión, manda al login.
// La verificación real de la sesión y de los permisos ocurre en el servidor (lib/auth.ts).
export function proxy(request: NextRequest) {
  if (!request.cookies.get("cc_session")?.value) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/admin/:path*"] };
