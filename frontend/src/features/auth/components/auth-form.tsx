"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiErrorAlert } from "@features/auth/components/api-error-alert";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import { login, register } from "@features/auth/lib/client";
import { getSafeNextPath } from "@features/auth/lib/next-path";

type AuthMode = "login" | "register";

interface AuthFormState {
  fullName: string;
  email: string;
  password: string;
}

const initialState: AuthFormState = {
  fullName: "",
  email: "",
  password: ""
};

export function AuthForm({
  mode,
  nextPath
}: {
  mode: AuthMode;
  nextPath?: string | null;
}) {
  const router = useRouter();
  const { copy } = useUserPreferences();
  const [state, setState] = useState<AuthFormState>(initialState);
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = useMemo(() => {
    if (mode === "register") {
      return {
        title: copy.auth.registerTitle,
        submitText: copy.auth.registerSubmit,
        helperText: copy.auth.helperAlreadyHasAccount,
        helperLink: "/login",
        helperLinkText: copy.auth.helperSignIn
      };
    }

    return {
      title: copy.auth.loginTitle,
      submitText: copy.auth.loginSubmit,
      helperText: copy.auth.helperNoAccount,
      helperLink: "/register",
      helperLinkText: copy.auth.helperCreateOne
    };
  }, [copy.auth, mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        email: state.email.trim(),
        password: state.password
      };

      if (mode === "register") {
        await register({
          ...payload,
          full_name: state.fullName.trim()
        });
      } else {
        await login(payload);
      }

      router.push(getSafeNextPath(nextPath ?? null));
      router.refresh();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <h1>{content.title}</h1>

      {mode === "register" ? (
        <>
          <label htmlFor="full-name">{copy.auth.fullNameLabel}</label>
          <input
            id="full-name"
            name="full_name"
            type="text"
            autoComplete="name"
            required
            className="input"
            value={state.fullName}
            onChange={(event) =>
              setState((previous) => ({ ...previous, fullName: event.target.value }))
            }
          />
        </>
      ) : null}

      <label htmlFor="email">{copy.auth.emailLabel}</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="input"
        value={state.email}
        onChange={(event) =>
          setState((previous) => ({ ...previous, email: event.target.value }))
        }
      />

      <label htmlFor="password">{copy.auth.passwordLabel}</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required
        minLength={8}
        className="input"
        value={state.password}
        onChange={(event) =>
          setState((previous) => ({ ...previous, password: event.target.value }))
        }
      />

      {error ? <ApiErrorAlert error={error} fallbackMessage={copy.auth.fallbackError} /> : null}

      <button type="submit" className="button button-primary" disabled={isSubmitting}>
        {isSubmitting ? copy.auth.processingLabel : content.submitText}
      </button>

      <p className="auth-helper">
        {content.helperText} <Link href={content.helperLink}>{content.helperLinkText}</Link>
      </p>
    </form>
  );
}
