"use client";

import { type FormEvent, useState } from "react";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import { useProfileViewModel } from "@features/profile/hooks/use-profile-view-model";

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
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

export function ProfileView() {
  const { copy, language } = useUserPreferences();
  const c = copy.profile;
  const {
    user,
    isLoading,
    nameMutation,
    emailMutation,
    passwordMutation,
    nameSuccess,
    emailSuccess,
    passwordSuccess,
    resolveErrorMessage
  } = useProfileViewModel(c);

  const [nameValue, setNameValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nameValue.trim()) return;
    nameMutation.mutate(nameValue.trim());
  }

  function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!emailValue.trim() || !emailPassword) return;
    emailMutation.mutate({ email: emailValue.trim(), current_password: emailPassword });
  }

  function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    passwordMutation.mutate({ current_password: currentPassword, new_password: newPassword });
  }

  if (isLoading || !user) {
    return (
      <section className="profile-view">
        <p className="muted-text">{copy.dashboard.loading}</p>
      </section>
    );
  }

  const initials = getInitials(user.full_name);
  const avatarColor = getAvatarColor(user.full_name);

  return (
    <section className="profile-view">
      <div className="profile-header">
        <div className="profile-avatar-lg" style={{ background: avatarColor }}>
          {initials}
        </div>
        <div className="profile-header-info">
          <h2 className="profile-name">{user.full_name}</h2>
          <p className="profile-email">{user.email}</p>
          <p className="profile-since">
            {c.memberSince} {formatDate(user.created_at, language === "ru" ? "ru-RU" : "en-US")}
          </p>
        </div>
      </div>

      <div className="profile-sections">
        <div className="profile-section">
          <h3 className="profile-section-title">{c.editNameTitle}</h3>
          <form onSubmit={handleNameSubmit} className="profile-form">
            <input
              className="input"
              type="text"
              placeholder={user.full_name}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
            />
            <button
              type="submit"
              className="button button-primary profile-save-btn"
              disabled={nameMutation.isPending || !nameValue.trim()}
            >
              {nameMutation.isPending ? c.saving : c.saveNameButton}
            </button>
            {nameSuccess && <p className="profile-success">{c.successMessage}</p>}
            {nameMutation.isError && (
              <p className="profile-error">{resolveErrorMessage(nameMutation.error)}</p>
            )}
          </form>
        </div>

        <div className="profile-section">
          <h3 className="profile-section-title">{c.changeEmailTitle}</h3>
          <form onSubmit={handleEmailSubmit} className="profile-form">
            <input
              className="input"
              type="email"
              placeholder={user.email}
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              autoComplete="email"
            />
            <input
              className="input"
              type="password"
              placeholder={c.currentPasswordLabel}
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="button button-primary profile-save-btn"
              disabled={emailMutation.isPending || !emailValue.trim() || !emailPassword}
            >
              {emailMutation.isPending ? c.saving : c.saveButton}
            </button>
            {emailSuccess && <p className="profile-success">{c.successMessage}</p>}
            {emailMutation.isError && (
              <p className="profile-error">{resolveErrorMessage(emailMutation.error)}</p>
            )}
          </form>
        </div>

        <div className="profile-section">
          <h3 className="profile-section-title">{c.changePasswordTitle}</h3>
          <form onSubmit={handlePasswordSubmit} className="profile-form">
            <input
              className="input"
              type="password"
              placeholder={c.currentPasswordLabel}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
            <input
              className="input"
              type="password"
              placeholder={c.newPasswordLabel}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="submit"
              className="button button-primary profile-save-btn"
              disabled={passwordMutation.isPending || !currentPassword || !newPassword}
            >
              {passwordMutation.isPending ? c.saving : c.saveButton}
            </button>
            {passwordSuccess && <p className="profile-success">{c.successMessage}</p>}
            {passwordMutation.isError && (
              <p className="profile-error">{resolveErrorMessage(passwordMutation.error)}</p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
