"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { type AppCopy, type AppLanguage, type AppTheme, getAppCopy } from "@shared/i18n/ui-copy";

interface UserPreferencesContextValue {
  language: AppLanguage;
  theme: AppTheme;
  copy: AppCopy;
  activeRoadmapId: string | null;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: AppTheme) => void;
  setActiveRoadmapId: (id: string) => void;
}

const ACTIVE_ROADMAP_KEY = "improve:activeRoadmapId";

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

export function UserPreferencesProvider({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const language: AppLanguage = "ru";
  const theme: AppTheme = "light";

  const [activeRoadmapId, setActiveRoadmapIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_ROADMAP_KEY);
  });

  const setActiveRoadmapId = useCallback((id: string) => {
    setActiveRoadmapIdState(id);
    localStorage.setItem(ACTIVE_ROADMAP_KEY, id);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
  }, [language, theme]);

  const contextValue = useMemo<UserPreferencesContextValue>(() => {
    return {
      language,
      theme,
      copy: getAppCopy(language),
      activeRoadmapId,
      setLanguage: () => {},
      setTheme: () => {},
      setActiveRoadmapId
    };
  }, [language, theme, activeRoadmapId, setActiveRoadmapId]);

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
