"use client";

import { ProfileView } from "@features/profile/components/profile-view";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";

export default function SettingsPage() {
  const { copy } = useUserPreferences();

  return (
    <div>
      <section className="panel settings-view">
        <h2>{copy.settings.title}</h2>
        <div className="settings-info-row">
          <span>Язык интерфейса</span>
          <strong>Русский</strong>
        </div>
        <div className="settings-info-row">
          <span>Тема оформления</span>
          <strong>Светлая</strong>
        </div>
      </section>

      <ProfileView />
    </div>
  );
}
