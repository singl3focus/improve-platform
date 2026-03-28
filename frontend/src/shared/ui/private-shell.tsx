"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Check,
  Plus,
  LayoutDashboard,
  Map,
  ListTodo,
  Library,
  LogOut,
  LucideIcon,
} from "lucide-react";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import { logout } from "@features/auth/lib/client";
import { useCurrentUser } from "@features/profile/hooks/use-profile-view-model";
import { authFetch } from "@features/auth/lib/auth-fetch";
import type { BackendRoadmapListItem } from "@shared/api/backend-contracts";
import type { RoadmapListItem } from "@features/roadmap/types";

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarColor(name: string): string {
  const colors = [
    "#2a7de1", "#7c3aed", "#059669", "#d97706",
    "#dc2626", "#0891b2", "#be185d", "#65a30d"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}

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

function RoadmapSwitcher() {
  const { copy, activeRoadmapId, setActiveRoadmapId } = useUserPreferences();
  const [roadmaps, setRoadmaps] = useState<RoadmapListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadRoadmaps = useCallback(async () => {
    try {
      const res = await authFetch("/api/roadmaps");
      if (res.ok) {
        const raw = (await res.json()) as BackendRoadmapListItem[];
        const data: RoadmapListItem[] = raw.map((r) => ({
          id: r.id,
          title: r.title,
          totalTopics: r.total_topics,
          completedTopics: r.completed_topics,
          progressPercent: r.progress_percent,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        setRoadmaps(data);
        if (!activeRoadmapId && data.length > 0) {
          setActiveRoadmapId(data[0].id);
        }
      }
    } catch {
      // silent
    }
  }, [activeRoadmapId, setActiveRoadmapId]);

  useEffect(() => {
    loadRoadmaps();
  }, [loadRoadmaps]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeRoadmap = roadmaps.find((r) => r.id === activeRoadmapId);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    try {
      const res = await authFetch("/api/roadmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (res.ok) {
        const created = await res.json();
        setActiveRoadmapId(created.id);
        setNewTitle("");
        setCreating(false);
        setOpen(false);
        await loadRoadmaps();
      }
    } catch {
      // silent
    }
  }

  if (roadmaps.length === 0) return null;

  return (
    <div className="roadmap-switcher" ref={dropdownRef}>
      <button
        type="button"
        className="roadmap-switcher-trigger"
        onClick={() => setOpen(!open)}
      >
        <Map size={14} />
        <span className="roadmap-switcher-label">
          {activeRoadmap?.title ?? copy.dashboard.roadmapSwitcherLabel}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="roadmap-switcher-dropdown">
          {roadmaps.map((rm) => (
            <button
              key={rm.id}
              type="button"
              className={`roadmap-switcher-item${rm.id === activeRoadmapId ? " roadmap-switcher-item-active" : ""}`}
              onClick={() => {
                setActiveRoadmapId(rm.id);
                setOpen(false);
              }}
            >
              {rm.id === activeRoadmapId && <Check size={14} />}
              {rm.title}
            </button>
          ))}
          <div className="roadmap-switcher-divider" />
          {creating ? (
            <div className="roadmap-switcher-create-form">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={copy.dashboard.newRoadmapPlaceholder}
                className="roadmap-switcher-create-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
                autoFocus
              />
              <button
                type="button"
                className="roadmap-switcher-create-confirm"
                onClick={handleCreate}
                disabled={!newTitle.trim()}
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="roadmap-switcher-item roadmap-switcher-new"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} />
              {copy.dashboard.newRoadmapPlaceholder}
            </button>
          )}
        </div>
      )}
    </div>
  );
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
        <Link href="/profile" className="user-identity">
          {currentUser ? (
            <>
              <span
                className="user-avatar"
                style={{ background: getAvatarColor(currentUser.full_name) }}
              >
                {getInitials(currentUser.full_name)}
              </span>
              <span className="user-full-name">{currentUser.full_name}</span>
            </>
          ) : (
            <span className="user-avatar user-avatar-placeholder" />
          )}
        </Link>
        <RoadmapSwitcher />
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
