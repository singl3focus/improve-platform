import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@features/auth/lib/session";
import { getBackendApiUrl, getResponseCandidates, getStringValue, isRecord } from "@shared/api/backend-shared";

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

interface BackendFetchOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

interface BackendFetchResult {
  response: Response;
  payload: unknown;
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractSessionTokens(payload: unknown): SessionTokens | null {
  const candidates = getResponseCandidates(payload);

  for (const candidate of candidates) {
    const accessToken =
      getStringValue(candidate, "accessToken") ??
      getStringValue(candidate, "access_token") ??
      getStringValue(candidate, "token");
    const refreshToken =
      getStringValue(candidate, "refreshToken") ?? getStringValue(candidate, "refresh_token");
    const accessExpiresIn = Number(candidate.accessExpiresIn ?? candidate.access_expires_in ?? 900);
    const refreshExpiresIn = Number(
      candidate.refreshExpiresIn ?? candidate.refresh_expires_in ?? 1_209_600
    );

    if (accessToken && refreshToken) {
      return {
        accessToken,
        refreshToken,
        accessExpiresIn: Number.isFinite(accessExpiresIn) ? accessExpiresIn : 900,
        refreshExpiresIn: Number.isFinite(refreshExpiresIn) ? refreshExpiresIn : 1_209_600
      };
    }
  }

  return null;
}

async function requestBackend(
  path: string,
  options: BackendFetchOptions,
  accessToken: string | null
): Promise<BackendFetchResult> {
  const headers: HeadersInit = {
    Accept: "application/json"
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(getBackendApiUrl(path), {
    method: options.method,
    cache: "no-store",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const payload = await readResponseJson(response);
  return { response, payload };
}

async function refreshSessionTokens(refreshToken: string): Promise<SessionTokens | null> {
  try {
    const response = await fetch(getBackendApiUrl("/api/v1/auth/refresh"), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      return null;
    }

    const payload = await readResponseJson(response);
    return extractSessionTokens(payload);
  } catch {
    return null;
  }
}

function applySessionCookies(response: NextResponse, tokens: SessionTokens): void {
  const common = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/"
  };

  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: tokens.accessToken,
    maxAge: tokens.accessExpiresIn,
    ...common
  });

  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: tokens.refreshToken,
    maxAge: tokens.refreshExpiresIn,
    ...common
  });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: "",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: "",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
}

export function getBackendErrorCode(payload: unknown): string | null {
  const record = isRecord(payload) ? payload : null;
  const nestedError = record && isRecord(record.error) ? record.error : null;

  return getStringValue(record, "code") ?? getStringValue(nestedError, "code") ?? null;
}

export function isBackendErrorCode(payload: unknown, code: string): boolean {
  return getBackendErrorCode(payload) === code;
}

export function createBackendErrorResponse(
  response: Response,
  payload: unknown,
  fallbackMessage: string
): NextResponse {
  const record = isRecord(payload) ? payload : null;
  const nestedError = record && isRecord(record.error) ? record.error : null;

  const message =
    (getStringValue(record, "message") ??
      getStringValue(nestedError, "message") ??
      response.statusText) ||
    fallbackMessage;
  const code = getStringValue(record, "code") ?? getStringValue(nestedError, "code") ?? null;

  const errorResponse = NextResponse.json(
    {
      message,
      status: response.status,
      code
    },
    { status: response.status }
  );

  if (response.status === 401) {
    clearSessionCookies(errorResponse);
  }

  return errorResponse;
}

export function createBackendUnavailableResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      message,
      status: 502,
      code: "BACKEND_UNAVAILABLE"
    },
    { status: 502 }
  );
}

export function createBackendClient(request: NextRequest) {
  let accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  let refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
  let updatedSessionTokens: SessionTokens | null = null;

  async function call(path: string, options: BackendFetchOptions): Promise<BackendFetchResult> {
    const firstAttempt = await requestBackend(path, options, accessToken);

    if (firstAttempt.response.status !== 401 || !refreshToken) {
      return firstAttempt;
    }

    const refreshed = await refreshSessionTokens(refreshToken);
    if (!refreshed) {
      return firstAttempt;
    }

    updatedSessionTokens = refreshed;
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;

    return requestBackend(path, options, accessToken);
  }

  function applyUpdatedSession(response: NextResponse): void {
    if (updatedSessionTokens) {
      applySessionCookies(response, updatedSessionTokens);
    }
  }

  return {
    call,
    applyUpdatedSession
  };
}
