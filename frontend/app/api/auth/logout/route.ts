import { NextRequest, NextResponse } from "next/server";
import {
  BACKEND_AUTH_PATHS,
  callBackendAuth,
  clearSessionCookies
} from "../_shared";
import { REFRESH_TOKEN_COOKIE } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    try {
      await callBackendAuth(BACKEND_AUTH_PATHS.logout, {
        method: "POST",
        body: { refreshToken }
      });
    } catch {
      // Ignore backend logout errors and always clear local session cookies.
    }
  }

  const response = NextResponse.json(
    {
      authenticated: false
    },
    { status: 200 }
  );
  clearSessionCookies(request, response);

  return response;
}
