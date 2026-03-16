import { getBackendApiUrl, getResponseCandidates, getStringValue } from "@/lib/backend-shared";

function hasSessionTokens(payload: unknown): boolean {
  const candidates = getResponseCandidates(payload);

  return candidates.some((record) => {
    const accessToken =
      getStringValue(record, "accessToken") ??
      getStringValue(record, "access_token") ??
      getStringValue(record, "token");
    const refreshToken =
      getStringValue(record, "refreshToken") ?? getStringValue(record, "refresh_token");

    return Boolean(accessToken && refreshToken);
  });
}

export async function hasValidServerSession(refreshToken: string | undefined): Promise<boolean> {
  if (!refreshToken) {
    return false;
  }

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
      return false;
    }

    const payload = await response.json().catch(() => null);
    return hasSessionTokens(payload);
  } catch {
    return false;
  }
}
