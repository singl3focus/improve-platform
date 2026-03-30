/**
 * Client-side fetch wrapper that redirects to /login on 401 (Unauthorized).
 *
 * All client-side API calls in view models should use `authFetch` instead of
 * the global `fetch`. When a response comes back with status 401 it means the
 * session is expired and cannot be refreshed (the Next.js API proxy already
 * attempts a token refresh on the server side). In that case we force a
 * redirect so the user never stays on a protected page with a stale session.
 */

let redirecting = false;

function redirectToLogin(): void {
  if (redirecting) {
    return;
  }
  redirecting = true;
  window.location.href = "/login";
}

function getBrowserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export async function authFetch(
  input: URL | RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const timeZone = getBrowserTimeZone();

  if (timeZone) {
    headers.set("X-Timezone", timeZone);
  }

  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers
  });

  if (response.status === 401) {
    redirectToLogin();
  }

  return response;
}
