export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getStringField(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export async function parseApiError(response: Response): Promise<ApiError> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const record = asRecord(payload);
  const message =
    getStringField(record, "message") ??
    getStringField(record, "error") ??
    response.statusText ??
    "Request failed";

  return {
    message,
    status: response.status,
    code: getStringField(record, "code"),
    details: record?.details
  };
}
