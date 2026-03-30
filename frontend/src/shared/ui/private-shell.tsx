"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Library,
  LayoutDashboard,
  ListTodo,
  LogOut,
  LucideIcon,
  Map,
  Sun
} from "lucide-react";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import { logout } from "@features/auth/lib/client";
import { useCurrentUser } from "@features/profile/hooks/use-profile-view-model";

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarColor(name: string): string {
  const colors = [
    "#2a7de1",
    "#7c3aed",
    "#059669",
    "#d97706",
    "#dc2626",
    "#0891b2",
    "#be185d",
    "#65a30d"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}

type NavItemKey =
  | "todayLabel"
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
  { href: "/today", key: "todayLabel", icon: Sun },
  { href: "/dashboard", key: "dashboardLabel", icon: LayoutDashboard },
  { href: "/roadmap", key: "roadmapLabel", icon: Map },
  { href: "/tasks", key: "tasksLabel", icon: ListTodo },
  { href: "/materials", key: "materialsLabel", icon: Library }
];

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrivateShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { copy } = useUserPreferences();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { data: currentUser } = useCurrentUser();

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
          <strong className="brand-wordmark">{copy.navigation.brand}</strong>
        </div>

        <Link href="/profile" className="user-identity">
          {currentUser ? (
            <>
              <span
                className="user-avatar"
                style={{ background: getAvatarColor(currentUser.full_name) }}
              >
                {getInitials(currentUser.full_name)}
              </span>
              <span className="user-identity-copy">
                <span className="user-full-name">{currentUser.full_name}</span>
                <span className="user-email">{currentUser.email}</span>
              </span>
            </>
          ) : (
            <span className="user-avatar user-avatar-placeholder" />
          )}
        </Link>

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
            className="sidebar-logout-action"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut size={16} />
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
