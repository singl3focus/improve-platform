import { NextRequest, NextResponse } from "next/server";
import {
  BACKEND_AUTH_PATHS,
  backendUnavailableResponse,
  buildErrorResponse,
  callBackendAuth,
  clearSessionCookies,
  extractSessionTokens,
  extractUser,
  setSessionCookies
} from "../_shared";
import { REFRESH_TOKEN_COOKIE } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json(
      {
        message: "Refresh token is missing.",
        status: 401,
        code: "SESSION_EXPIRED"
      },
      { status: 401 }
    );
  }

  let response: Response;
  let payload: unknown;

  try {
    const backendResult = await callBackendAuth(BACKEND_AUTH_PATHS.refresh, {
      method: "POST",
      body: { refreshToken }
    });
    response = backendResult.response;
    payload = backendResult.payload;
  } catch {
    return backendUnavailableResponse();
  }

  if (!response.ok) {
    const errorResponse = buildErrorResponse(response, payload);
    if (response.status === 401) {
      clearSessionCookies(errorResponse);
    }
    return errorResponse;
  }

  const tokens = extractSessionTokens(payload);
  if (!tokens) {
    return NextResponse.json(
      {
        message: "Refresh response does not include updated session tokens.",
        status: 502,
        code: "INVALID_REFRESH_RESPONSE"
      },
      { status: 502 }
    );
  }

  const authResponse = NextResponse.json(
    {
      authenticated: true,
      user: extractUser(payload)
    },
    { status: 200 }
  );
  setSessionCookies(authResponse, tokens);
  return authResponse;
}
