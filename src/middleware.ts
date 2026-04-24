import { NextResponse, type NextRequest } from "next/server";

// Auth minimale par mot de passe partagé.
// Un cookie signé est émis après connexion ; il expire après 30 jours.
// Variable d'env obligatoire en prod : APP_PASSWORD.
// Pour désactiver temporairement l'auth (dev local) : APP_PASSWORD vide.

const COOKIE_NAME = "planify_auth";
const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Laisser passer les ressources statiques et le login
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  const password = process.env.APP_PASSWORD;
  // Pas de mot de passe défini = pas d'auth (dev local)
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const expected = await sign(password);
  if (cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

async function sign(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode("planify:" + secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
