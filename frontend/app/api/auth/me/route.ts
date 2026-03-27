import { NextRequest, NextResponse } from "next/server";
import { backendUnavailableResponse, buildErrorResponse } from "../_shared";
import { ACCESS_TOKEN_COOKIE } from "@features/auth/lib/session";
import { getBackendApiUrl } from "@shared/api/backend-shared";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json(
      { message: "Not authenticated.", status: 401, code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let response: Response;
  let payload: unknown;

  try {
    response = await fetch(getBackendApiUrl("/api/v1/me"), {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });
    payload = await response.json().catch(() => null);
  } catch {
    return backendUnavailableResponse();
  }

  if (!response.ok) {
    return buildErrorResponse(response, payload);
  }

  return NextResponse.json(payload, { status: 200 });
}
