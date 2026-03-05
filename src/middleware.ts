import { NextRequest, NextResponse } from "next/server";

async function hashToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("dash_auth")?.value;
  const expected = process.env.DASH_PASSWORD;

  if (!expected) return NextResponse.next();

  // Allow the login API through
  if (request.nextUrl.pathname === "/api/login") return NextResponse.next();

  const expectedHash = await hashToken(expected);
  if (token !== expectedHash) {
    // For API routes, return 401
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // For pages, rewrite to login
    return NextResponse.rewrite(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
