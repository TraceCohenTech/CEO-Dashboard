import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("dash_auth")?.value;
  const expected = process.env.DASH_PASSWORD;

  if (!expected) return NextResponse.next();

  // Allow the login API through
  if (request.nextUrl.pathname === "/api/login") return NextResponse.next();

  if (token !== expected) {
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
