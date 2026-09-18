import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/gt", "/pt", "/trainer", "/admin", "/billing"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();
  const session = request.cookies.get("elevate_session")?.value;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/enter";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/gt/:path*", "/gt", "/pt/:path*", "/pt", "/trainer/:path*", "/trainer", "/admin/:path*", "/admin", "/billing/:path*"],
};
