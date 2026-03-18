"use client";

import { usePathname } from "next/navigation";
import { PreferencesControls } from "@/components/layout/preferences-controls";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";

const PRIVATE_PATH_PREFIXES = ["/dashboard", "/roadmap", "/tasks", "/materials", "/settings"];

export function GlobalUiControls() {
  const pathname = usePathname();
  const { copy } = useUserPreferences();

  if (PRIVATE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  return (
    <aside className="global-ui-controls" aria-label={copy.settings.title}>
      <PreferencesControls
        className="global-preferences-controls"
        controlClassName="global-preferences-control"
      />
    </aside>
  );
}
