export function getSafeNextPath(nextPath: string | null): string {
  if (!nextPath) {
    return "/dashboard";
  }

  const candidate = nextPath.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/dashboard";
  }

  try {
    const normalized = new URL(candidate, "http://localhost");
    if (normalized.origin !== "http://localhost") {
      return "/dashboard";
    }

    return `${normalized.pathname}${normalized.search}${normalized.hash}`;
  } catch {
    return "/dashboard";
  }
}
