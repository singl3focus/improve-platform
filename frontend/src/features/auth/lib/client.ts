import type { AuthCredentials, AuthRegisterCredentials, AuthResponse } from "@features/auth/lib/contracts";
import { parseApiError } from "@features/auth/lib/api-error";

const AUTH_API = {
  login: "/api/auth/login",
  register: "/api/auth/register",
  refresh: "/api/auth/refresh",
  logout: "/api/auth/logout",
  session: "/api/auth/session"
} as const;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function login(credentials: AuthCredentials): Promise<AuthResponse> {
  return request<AuthResponse>(AUTH_API.login, {
    method: "POST",
    body: JSON.stringify(credentials)
  });
}

export function register(credentials: AuthRegisterCredentials): Promise<AuthResponse> {
  return request<AuthResponse>(AUTH_API.register, {
    method: "POST",
    body: JSON.stringify(credentials)
  });
}

export function refreshSession(): Promise<AuthResponse> {
  return request<AuthResponse>(AUTH_API.refresh, { method: "POST" });
}

export function getSession(): Promise<AuthResponse> {
  return request<AuthResponse>(AUTH_API.session, { method: "GET" });
}

export function logout(): Promise<void> {
  return request<void>(AUTH_API.logout, { method: "POST" });
}

export async function fetchWithSessionRefresh(
  input: URL | RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const firstResponse = await fetch(input, {
    ...init,
    cache: "no-store",
    credentials: "include"
  });

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  try {
    await refreshSession();
  } catch {
    return firstResponse;
  }

  return fetch(input, {
    ...init,
    cache: "no-store",
    credentials: "include"
  });
}
