"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@features/auth/lib/auth-fetch";
import type { ProfileCopy } from "@shared/i18n/ui-copy";

export const CURRENT_USER_QUERY_KEY = "current-user";

export interface CurrentUser {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface UpdateProfilePayload {
  full_name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}

async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await authFetch("/api/auth/me", { method: "GET" });
  if (!response.ok) {
    throw new Error("Failed to fetch current user");
  }
  return (await response.json()) as CurrentUser;
}

async function updateProfile(payload: UpdateProfilePayload): Promise<CurrentUser> {
  const response = await authFetch("/api/auth/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
    const error = new Error(err.message ?? "update failed") as Error & { code?: string };
    error.code = err.code;
    throw error;
  }
  return (await response.json()) as CurrentUser;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: [CURRENT_USER_QUERY_KEY],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000
  });
}

export function useProfileViewModel(copy: ProfileCopy) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();

  const [nameSuccess, setNameSuccess] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  function resolveErrorMessage(err: unknown): string {
    const e = err as Error & { code?: string };
    if (e.code === "wrong_password") return copy.errorWrongPassword;
    if (e.code === "email_exists") return copy.errorEmailExists;
    return copy.errorFallback;
  }

  const nameMutation = useMutation({
    mutationFn: (full_name: string) => updateProfile({ full_name }),
    onSuccess: (updated) => {
      queryClient.setQueryData<CurrentUser>([CURRENT_USER_QUERY_KEY], updated);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    }
  });

  const emailMutation = useMutation({
    mutationFn: ({ email, current_password }: { email: string; current_password: string }) =>
      updateProfile({ email, current_password }),
    onSuccess: (updated) => {
      queryClient.setQueryData<CurrentUser>([CURRENT_USER_QUERY_KEY], updated);
      setEmailSuccess(true);
      setTimeout(() => setEmailSuccess(false), 3000);
    }
  });

  const passwordMutation = useMutation({
    mutationFn: ({
      current_password,
      new_password
    }: {
      current_password: string;
      new_password: string;
    }) => updateProfile({ current_password, new_password }),
    onSuccess: () => {
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  });

  return {
    user,
    isLoading,
    nameMutation,
    emailMutation,
    passwordMutation,
    nameSuccess,
    emailSuccess,
    passwordSuccess,
    resolveErrorMessage
  };
}
