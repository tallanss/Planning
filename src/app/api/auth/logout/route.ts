import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const url = new URL("/login", req.url);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set("planify_auth", "", { path: "/", maxAge: 0 });
  return res;
}
