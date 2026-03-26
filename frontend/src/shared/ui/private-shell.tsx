"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  ListTodo,
  Library,
  LucideIcon,
} from "lucide-react";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import { logout } from "@features/auth/lib/client";

type NavItemKey =
  | "dashboardLabel"
  | "roadmapLabel"
  | "tasksLabel"
  | "materialsLabel";

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

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrivateShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { copy } = useUserPreferences();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
          <strong>{copy.navigation.brand}</strong>
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
        
        <div className="nav-list nav-list-bottom" aria-label={copy.settings.title}>
          <button
            type="button"
            className="sidebar-text-action"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? copy.navigation.signingOut : copy.navigation.signOut}
          </button>
        </div>
      </aside>

      <div className="content-column">
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
