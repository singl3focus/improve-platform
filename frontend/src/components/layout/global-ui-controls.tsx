"use client";

import { PreferencesControls } from "@/components/layout/preferences-controls";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";

export function GlobalUiControls() {
  const { copy } = useUserPreferences();

  return (
    <aside className="global-ui-controls" aria-label={copy.settings.title}>
      <PreferencesControls
        className="global-preferences-controls"
        controlClassName="global-preferences-control"
      />
    </aside>
  );
}
