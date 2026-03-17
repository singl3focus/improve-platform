"use client";

import { PreferencesControls } from "@/components/layout/preferences-controls";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";

export default function SettingsPage() {
  const { copy } = useUserPreferences();

  return (
    <section className="panel settings-view">
      <h2>{copy.settings.title}</h2>
      <p>{copy.settings.description}</p>

      <PreferencesControls
        className="settings-control-grid"
        controlClassName="settings-control"
      />

      <p className="settings-note">{copy.settings.applyNote}</p>
    </section>
  );
}
