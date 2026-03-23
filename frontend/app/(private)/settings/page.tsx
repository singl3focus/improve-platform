"use client";

import { useUserPreferences } from "@/components/providers/user-preferences-provider";

export default function SettingsPage() {
  const { copy } = useUserPreferences();

  return (
    <section className="panel settings-view">
      <h2>{copy.settings.title}</h2>
      <p>Интерфейс зафиксирован на русском языке и светлой теме.</p>
    </section>
  );
}
