"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo
} from "react";
import { type AppCopy, type AppLanguage, type AppTheme, getAppCopy } from "@shared/i18n/ui-copy";

interface UserPreferencesContextValue {
  language: AppLanguage;
  theme: AppTheme;
  copy: AppCopy;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: AppTheme) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

export function UserPreferencesProvider({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const language: AppLanguage = "ru";
  const theme: AppTheme = "light";

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
  }, [language, theme]);

  const contextValue = useMemo<UserPreferencesContextValue>(() => {
    return {
      language,
      theme,
      copy: getAppCopy(language),
      setLanguage: () => {},
      setTheme: () => {}
    };
  }, [language, theme]);

  return (
    <UserPreferencesContext.Provider value={contextValue}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error("useUserPreferences must be used within UserPreferencesProvider");
  }
  return context;
}
