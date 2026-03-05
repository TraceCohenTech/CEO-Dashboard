import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const expected = process.env.DASH_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Invalid" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("dash_auth", expected, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return response;
}
