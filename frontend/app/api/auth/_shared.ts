import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/session";
import type { AuthCredentials, AuthRegisterCredentials, AuthUser } from "@/lib/auth/contracts";
import {
  getBackendApiUrl,
  getNumberValue,
  getResponseCandidates,
  getStringValue,
  isRecord
} from "@/lib/backend-shared";

export const BACKEND_AUTH_PATHS = {
  login: "/api/v1/auth/login",
  register: "/api/v1/auth/register",
  refresh: "/api/v1/auth/refresh",
  logout: "/api/v1/auth/logout"
} as const;

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

interface ParsedBodyResult {
  data: AuthCredentials | AuthRegisterCredentials | null;
  error: NextResponse | null;
}

interface ParseAuthCredentialsOptions {
  requireFullName?: boolean;
}

export async function parseAuthCredentials(
  request: NextRequest,
  options?: ParseAuthCredentialsOptions
): Promise<ParsedBodyResult> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { message: "Invalid JSON body.", status: 400, code: "BAD_REQUEST" },
        { status: 400 }
      )
    };
  }

  const record = isRecord(body) ? body : null;
  const email = getStringValue(record, "email");
  const password = getStringValue(record, "password");
  const fullName = getStringValue(record, "full_name");
  const requireFullName = options?.requireFullName === true;

  if (!email || !password || (requireFullName && !fullName)) {
    return {
      data: null,
      error: NextResponse.json(
        {
          message: requireFullName
            ? "Full name, email and password are required."
            : "Email and password are required.",
          status: 400,
          code: "VALIDATION_ERROR"
        },
        { status: 400 }
      )
    };
  }

  if (requireFullName) {
    return {
      data: {
        full_name: fullName!.trim(),
        email: email.trim(),
        password
      },
      error: null
    };
  }

  return {
    data: {
      email: email.trim(),
      password
    },
    error: null
  };
}

export async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function callBackendAuth(
  path: string,
  init: {
    method: "GET" | "POST";
    body?: unknown;
    token?: string;
  }
): Promise<{ response: Response; payload: unknown }> {
  const headers: HeadersInit = {
    "Content-Type": "application/json"
  };

  if (init.token) {
    headers.Authorization = `Bearer ${init.token}`;
  }

  const response = await fetch(getBackendApiUrl(path), {
    method: init.method,
    cache: "no-store",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined
  });

  const payload = await readResponseJson(response);
  return { response, payload };
}

export function backendUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      message: "Auth backend is unavailable.",
      status: 502,
      code: "AUTH_BACKEND_UNAVAILABLE"
    },
    { status: 502 }
  );
}

export function buildErrorResponse(response: Response, payload: unknown): NextResponse {
  const record = isRecord(payload) ? payload : null;
  const message =
    getStringValue(record, "message") ??
    getStringValue(record, "error") ??
    response.statusText ??
    "Auth request failed.";
  const code = getStringValue(record, "code");

  return NextResponse.json(
    {
      message,
      status: response.status,
      code,
      details: record?.details
    },
    { status: response.status }
  );
}

export function extractSessionTokens(payload: unknown): SessionTokens | null {
  const candidates = getResponseCandidates(payload);

  for (const record of candidates) {
    const accessToken =
      getStringValue(record, "accessToken") ??
      getStringValue(record, "access_token") ??
      getStringValue(record, "token");
    const refreshToken =
      getStringValue(record, "refreshToken") ?? getStringValue(record, "refresh_token");
    const accessExpiresIn =
      getNumberValue(record, "accessExpiresIn") ??
      getNumberValue(record, "access_expires_in") ??
      getNumberValue(record, "expiresIn") ??
      15 * 60;
    const refreshExpiresIn =
      getNumberValue(record, "refreshExpiresIn") ??
      getNumberValue(record, "refresh_expires_in") ??
      14 * 24 * 60 * 60;

    if (accessToken && refreshToken) {
      return {
        accessToken,
        refreshToken,
        accessExpiresIn,
        refreshExpiresIn
      };
    }
  }

  return null;
}

export function extractUser(payload: unknown): AuthUser | undefined {
  const candidates = getResponseCandidates(payload);

  for (const record of candidates) {
    const user = isRecord(record.user) ? record.user : null;
    if (!user) {
      continue;
    }

    const id = getStringValue(user, "id");
    const email = getStringValue(user, "email");
    const fullName = getStringValue(user, "full_name") ?? getStringValue(user, "fullName");
    if (id || email || fullName) {
      return { id, email, full_name: fullName };
    }
  }

  return undefined;
}

function isSecureCookieRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto) {
    return forwardedProto === "https";
  }

  return request.nextUrl.protocol === "https:";
}

export function setSessionCookies(
  request: NextRequest,
  response: NextResponse,
  tokens: SessionTokens
): void {
  const common = {
    httpOnly: true,
    secure: isSecureCookieRequest(request),
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

export function clearSessionCookies(request: NextRequest, response: NextResponse): void {
  const secure = isSecureCookieRequest(request);

  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: "",
    maxAge: 0,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/"
  });

  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: "",
    maxAge: 0,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/"
  });
}
