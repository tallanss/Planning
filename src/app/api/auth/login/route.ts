import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "planify_auth";

async function sign(secret: string): Promise<string> {
  const data = new TextEncoder().encode("planify:" + secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }
  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const token = await sign(expected);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
  return res;
}
