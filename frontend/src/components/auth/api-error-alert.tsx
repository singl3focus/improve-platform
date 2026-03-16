import type { ApiError } from "@/lib/auth/api-error";

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as ApiError).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

export function ApiErrorAlert({
  error,
  fallbackMessage
}: {
  error: unknown;
  fallbackMessage: string;
}) {
  return (
    <div className="alert-error" role="alert" aria-live="polite">
      {getErrorMessage(error, fallbackMessage)}
    </div>
  );
}
