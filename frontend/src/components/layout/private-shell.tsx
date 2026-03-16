"use client";

import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import { logout } from "@/lib/auth/client";

const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboardLabel" },
  { href: "/roadmap", key: "roadmapLabel" },
  { href: "/tasks", key: "tasksLabel" },
  { href: "/materials", key: "materialsLabel" },
  { href: "/settings", key: "settingsLabel" }
] as const satisfies ReadonlyArray<{
  href: string;
  key:
    | "dashboardLabel"
    | "roadmapLabel"
    | "tasksLabel"
    | "materialsLabel"
    | "settingsLabel";
}>;

export function PrivateShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { copy } = useUserPreferences();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const currentSection = useMemo(() => {
    const match = NAV_ITEMS.find((item) => pathname === item.href);
    if (!match) {
      return copy.navigation.appLabel;
    }
    return copy.navigation[match.key];
  }, [copy.navigation, pathname]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push("/login");
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">{copy.navigation.brand}</div>
        <nav className="nav-list" aria-label={copy.navigation.ariaPrimary}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "nav-link nav-link-active" : "nav-link"}
              >
                {copy.navigation[item.key]}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="content-column">
        <header className="header">
          <h1>{currentSection}</h1>
          <button
            type="button"
            className="button button-outline"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? copy.navigation.signingOut : copy.navigation.signOut}
          </button>
        </header>

        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
