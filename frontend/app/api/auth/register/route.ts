import { NextRequest, NextResponse } from "next/server";
import {
  BACKEND_AUTH_PATHS,
  backendUnavailableResponse,
  buildErrorResponse,
  callBackendAuth,
  extractSessionTokens,
  extractUser,
  parseAuthCredentials,
  setSessionCookies
} from "../_shared";

export async function POST(request: NextRequest) {
  const parsed = await parseAuthCredentials(request, { requireFullName: true });
  if (parsed.error) {
    return parsed.error;
  }
  if (!parsed.data) {
    return NextResponse.json(
      { message: "Auth payload is missing.", status: 400, code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  let response: Response;
  let payload: unknown;

  try {
    const backendResult = await callBackendAuth(BACKEND_AUTH_PATHS.register, {
      method: "POST",
      body: parsed.data
    });
    response = backendResult.response;
    payload = backendResult.payload;
  } catch {
    return backendUnavailableResponse();
  }

  if (!response.ok) {
    return buildErrorResponse(response, payload);
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

  setSessionCookies(request, authResponse, tokens);
  return authResponse;
}
