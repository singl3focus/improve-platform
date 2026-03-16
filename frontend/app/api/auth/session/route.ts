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

export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    const response = NextResponse.json(
      {
        message: "Session is not found.",
        status: 401,
        code: "SESSION_EXPIRED"
      },
      { status: 401 }
    );
    clearSessionCookies(response);
    return response;
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
        message: "Auth API response does not contain session tokens.",
        status: 502,
        code: "INVALID_AUTH_RESPONSE"
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

export async function POST(request: NextRequest) {
  return GET(request);
}
