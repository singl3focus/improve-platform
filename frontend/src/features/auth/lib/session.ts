export const ACCESS_TOKEN_COOKIE = "improve_access_token";
export const REFRESH_TOKEN_COOKIE = "improve_refresh_token";

export const AUTH_ROUTES = ["/login", "/register"] as const;
export const PROTECTED_ROUTES = [
  "/today",
  "/dashboard",
  "/roadmap",
  "/topics",
  "/tasks",
  "/materials",
  "/settings",
  "/profile"
] as const;

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route);
}

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}
