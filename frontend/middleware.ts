import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  isAuthRoute,
  isProtectedRoute
} from "@features/auth/lib/session";

type SessionValidation = "valid" | "invalid" | "unknown";

async function validateSession(request: NextRequest): Promise<SessionValidation> {
  const sessionUrl = new URL("/api/auth/session", request.url);
  const cookieHeader = request.headers.get("cookie");

  try {
    const response = await fetch(sessionUrl, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store"
    });

    if (response.ok) {
      return "valid";
    }

    if (response.status === 401) {
      return "invalid";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession =
    request.cookies.has(ACCESS_TOKEN_COOKIE) || request.cookies.has(REFRESH_TOKEN_COOKIE);

  if (isProtectedRoute(pathname)) {
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const sessionValidation = await validateSession(request);
    if (sessionValidation === "invalid") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return clearSessionCookies(NextResponse.redirect(loginUrl));
    }
  }

  if (isAuthRoute(pathname) && hasSession) {
    const sessionValidation = await validateSession(request);
    if (sessionValidation === "valid") {
      return NextResponse.redirect(new URL("/today", request.url));
    }

    if (sessionValidation === "invalid") {
      return clearSessionCookies(NextResponse.next());
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
