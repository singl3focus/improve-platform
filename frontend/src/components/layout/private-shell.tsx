"use client";

import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  ListTodo,
  Library,
  Settings,
  LucideIcon,
} from "lucide-react";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import { logout } from "@/lib/auth/client";

type NavItemKey =
  | "dashboardLabel"
  | "roadmapLabel"
  | "tasksLabel"
  | "materialsLabel"
  | "settingsLabel";

type NavItem = {
  href: string;
  key: NavItemKey;
  icon: LucideIcon;
};

const MAIN_NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/dashboard", key: "dashboardLabel", icon: LayoutDashboard },
  { href: "/roadmap", key: "roadmapLabel", icon: Map },
  { href: "/tasks", key: "tasksLabel", icon: ListTodo },
  { href: "/materials", key: "materialsLabel", icon: Library },
];

const BOTTOM_NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/settings", key: "settingsLabel", icon: Settings },
];

const ALL_NAV_ITEMS = [...MAIN_NAV_ITEMS, ...BOTTOM_NAV_ITEMS];

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrivateShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { copy } = useUserPreferences();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const currentSection = useMemo(() => {
    const match = ALL_NAV_ITEMS.find((item) => isItemActive(pathname, item.href));
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
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <strong>{copy.navigation.brand}</strong>
            <p>{copy.navigation.appLabel}</p>
          </div>
        </div>
        <nav className="nav-list nav-list-main" aria-label={copy.navigation.ariaPrimary}>
          {MAIN_NAV_ITEMS.map((item) => {
            const isActive = isItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "nav-link nav-link-active" : "nav-link"}
              >
                <Icon size={18} />
                {copy.navigation[item.key]}
              </Link>
            );
          })}
        </nav>
        
        <div className="sidebar-spacer" />
        
        <nav className="nav-list nav-list-bottom" aria-label={copy.navigation.settingsLabel}>
          {BOTTOM_NAV_ITEMS.map((item) => {
            const isActive = isItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "nav-link nav-link-active" : "nav-link"}
              >
                <Icon size={18} />
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
