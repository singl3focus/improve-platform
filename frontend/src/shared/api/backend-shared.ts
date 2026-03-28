const DEFAULT_BACKEND_API_URL = "http://localhost:8080";

export function sanitizeApiUrl(value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    return DEFAULT_BACKEND_API_URL;
  }

  return value.replace(/\/+$/, "");
}

export function getBackendApiUrl(path: string): string {
  const baseUrl = sanitizeApiUrl(process.env.BACKEND_API_URL);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (baseUrl.endsWith("/api/v1") && normalizedPath.startsWith("/api/v1")) {
    const suffix = normalizedPath.slice("/api/v1".length);
    return `${baseUrl}${suffix}`;
  }

  return `${baseUrl}${normalizedPath}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getStringValue(
  record: Record<string, unknown> | null,
  key: string
): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function getNumberValue(
  record: Record<string, unknown> | null,
  key: string
): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Extract an error message from a failed fetch Response.
 * Tries to parse JSON body for a `message` field, falls back to the given string.
 */
export async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload: unknown = await response.json();
    const record = isRecord(payload) ? payload : null;
    const nestedError = record && isRecord(record.error) ? record.error : null;

    return (
      getStringValue(record, "message") ??
      getStringValue(nestedError, "message") ??
      getStringValue(record, "error") ??
      (response.statusText || fallback)
    );
  } catch {
    // non-JSON response
  }
  return fallback;
}

export function getResponseCandidates(payload: unknown): Array<Record<string, unknown>> {
  const primary = isRecord(payload) ? payload : null;
  const candidates: Array<Record<string, unknown>> = [];

  if (!primary) {
    return candidates;
  }

  candidates.push(primary);
  if (isRecord(primary.data)) {
    candidates.push(primary.data);
  }
  if (isRecord(primary.session)) {
    candidates.push(primary.session);
  }
  if (isRecord(primary.tokens)) {
    candidates.push(primary.tokens);
  }

  return candidates;
}
