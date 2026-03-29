"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import { useProfileViewModel } from "@features/profile/hooks/use-profile-view-model";

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarColor(name: string): string {
  const colors = ["#2a7de1", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#be185d", "#65a30d"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch {
    return iso;
  }
}

type SectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

function ProfileSection({ eyebrow, title, description, children }: SectionProps) {
  return (
    <section className="panel profile-section-card">
      <header className="profile-section-header">
        <div>
          <p className="topic-card-kicker">{eyebrow}</p>
          <h3 className="profile-section-title">{title}</h3>
          <p className="profile-section-description">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export function ProfileView() {
  const { copy, language } = useUserPreferences();
  const c = copy.profile;
  const locale = language === "ru" ? "ru-RU" : "en-US";
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

  const profileCopy =
    language === "ru"
      ? {
          eyebrow: "Профиль",
          lead: "Управляйте основными данными аккаунта и доступом к рабочему пространству.",
          identityLabel: "Текущий профиль",
          emailLabel: "Email",
          memberLabel: "Статус",
          memberValue: "Активный участник",
          editNameDescription: "Обновите отображаемое имя в рабочем пространстве.",
          changeEmailDescription: "Смените адрес почты, который используется для входа.",
          changePasswordDescription: "Обновите пароль для доступа к аккаунту."
        }
      : {
          eyebrow: "Profile",
          lead: "Manage the core account details and access settings for your workspace.",
          identityLabel: "Current profile",
          emailLabel: "Email",
          memberLabel: "Status",
          memberValue: "Active member",
          editNameDescription: "Update the display name used across the workspace.",
          changeEmailDescription: "Change the email address used to sign in.",
          changePasswordDescription: "Update the password used to access the account."
        };

  function handleNameSubmit(event: FormEvent) {
    event.preventDefault();
    if (!nameValue.trim()) return;
    nameMutation.mutate(nameValue.trim());
  }

  function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    if (!emailValue.trim() || !emailPassword) return;
    emailMutation.mutate({ email: emailValue.trim(), current_password: emailPassword });
  }

  function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentPassword || !newPassword) return;
    passwordMutation.mutate({ current_password: currentPassword, new_password: newPassword });
  }

  if (isLoading || !user) {
    return (
      <section className="profile-view">
        <section className="panel profile-loading-panel">
          <p>{copy.dashboard.loading}</p>
          <div className="dashboard-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      </section>
    );
  }

  const initials = getInitials(user.full_name);
  const avatarColor = getAvatarColor(user.full_name);

  return (
    <section className="profile-view">
      <section className="panel profile-hero">
        <div className="profile-hero-main">
          <div className="profile-avatar-lg" style={{ background: avatarColor }}>
            {initials}
          </div>
          <div className="profile-header-info">
            <p className="dashboard-eyebrow">{profileCopy.eyebrow}</p>
            <h2 className="profile-name">{user.full_name}</h2>
            <p className="profile-hero-lead">{profileCopy.lead}</p>
          </div>
        </div>

        <div className="profile-hero-meta">
          <article className="profile-meta-card">
            <span>{profileCopy.identityLabel}</span>
            <strong>{initials}</strong>
          </article>
          <article className="profile-meta-card">
            <span>{profileCopy.emailLabel}</span>
            <strong>{user.email}</strong>
          </article>
          <article className="profile-meta-card">
            <span>{c.memberSince}</span>
            <strong>{formatDate(user.created_at, locale)}</strong>
          </article>
          <article className="profile-meta-card">
            <span>{profileCopy.memberLabel}</span>
            <strong>{profileCopy.memberValue}</strong>
          </article>
        </div>
      </section>

      <div className="profile-sections">
        <ProfileSection
          eyebrow={profileCopy.eyebrow}
          title={c.editNameTitle}
          description={profileCopy.editNameDescription}
        >
          <form onSubmit={handleNameSubmit} className="profile-form-grid">
            <label className="profile-field">
              <span>{c.fullNameLabel}</span>
              <input
                className="input"
                type="text"
                placeholder={user.full_name}
                value={nameValue}
                onChange={(event) => setNameValue(event.target.value)}
              />
            </label>
            <div className="profile-actions-row">
              <button
                type="submit"
                className="button button-primary profile-save-btn"
                disabled={nameMutation.isPending || !nameValue.trim()}
              >
                {nameMutation.isPending ? c.saving : c.saveNameButton}
              </button>
              {nameSuccess ? <p className="profile-success">{c.successMessage}</p> : null}
              {nameMutation.isError ? (
                <p className="profile-error">{resolveErrorMessage(nameMutation.error)}</p>
              ) : null}
            </div>
          </form>
        </ProfileSection>

        <ProfileSection
          eyebrow={profileCopy.emailLabel}
          title={c.changeEmailTitle}
          description={profileCopy.changeEmailDescription}
        >
          <form onSubmit={handleEmailSubmit} className="profile-form-grid">
            <label className="profile-field">
              <span>{c.newEmailLabel}</span>
              <input
                className="input"
                type="email"
                placeholder={user.email}
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="profile-field">
              <span>{c.currentPasswordLabel}</span>
              <input
                className="input"
                type="password"
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <div className="profile-actions-row">
              <button
                type="submit"
                className="button button-primary profile-save-btn"
                disabled={emailMutation.isPending || !emailValue.trim() || !emailPassword}
              >
                {emailMutation.isPending ? c.saving : c.saveButton}
              </button>
              {emailSuccess ? <p className="profile-success">{c.successMessage}</p> : null}
              {emailMutation.isError ? (
                <p className="profile-error">{resolveErrorMessage(emailMutation.error)}</p>
              ) : null}
            </div>
          </form>
        </ProfileSection>

        <ProfileSection
          eyebrow={c.changePasswordTitle}
          title={c.changePasswordTitle}
          description={profileCopy.changePasswordDescription}
        >
          <form onSubmit={handlePasswordSubmit} className="profile-form-grid profile-form-grid-double">
            <label className="profile-field">
              <span>{c.currentPasswordLabel}</span>
              <input
                className="input"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="profile-field">
              <span>{c.newPasswordLabel}</span>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <div className="profile-actions-row">
              <button
                type="submit"
                className="button button-primary profile-save-btn"
                disabled={passwordMutation.isPending || !currentPassword || !newPassword}
              >
                {passwordMutation.isPending ? c.saving : c.saveButton}
              </button>
              {passwordSuccess ? <p className="profile-success">{c.successMessage}</p> : null}
              {passwordMutation.isError ? (
                <p className="profile-error">{resolveErrorMessage(passwordMutation.error)}</p>
              ) : null}
            </div>
          </form>
        </ProfileSection>
      </div>
    </section>
  );
}
