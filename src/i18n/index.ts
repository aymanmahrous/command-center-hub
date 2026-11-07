import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ar } from "./ar";
import type { Dictionary } from "./en";

export type Language = "ar" | "en";
export type { Dictionary };

const STORAGE_KEY = "relaxfix-language";

function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

type Section<K extends keyof Dictionary> = Dictionary[K];

type LanguageContextValue = {
  language: Language;
  dir: "rtl" | "ltr";
  setLanguage: (language: Language) => void;
  t: <K extends keyof Dictionary>(section: K) => Section<K>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");
  const [dictionary, setDictionary] = useState<Dictionary>(ar);
  const languageRequestRef = useRef(0);
  const dir: "rtl" | "ltr" = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [dir, language]);

  useEffect(() => {
    if (readStoredLanguage() !== "en") return;
    const request = ++languageRequestRef.current;
    void import("./en").then(({ en: english }) => {
      if (languageRequestRef.current !== request) return;
      setDictionary(english);
      setLanguageState("en");
    }).catch(() => {
      // Keep the complete Arabic dictionary available if the optional chunk fails.
    });
    return () => {
      if (languageRequestRef.current === request) languageRequestRef.current += 1;
    };
  }, []);

  function setLanguage(next: Language) {
    const request = ++languageRequestRef.current;
    if (next === "ar") {
      setDictionary(ar);
      setLanguageState("ar");
      try {
        window.localStorage.setItem(STORAGE_KEY, "ar");
      } catch {
        /* ignore persistence failures (private browsing, quota, etc.) */
      }
      return;
    }

    void import("./en").then(({ en: english }) => {
      if (languageRequestRef.current !== request) return;
      setDictionary(english);
      setLanguageState("en");
      try {
        window.localStorage.setItem(STORAGE_KEY, "en");
      } catch {
        /* ignore persistence failures (private browsing, quota, etc.) */
      }
    }).catch(() => {
      if (languageRequestRef.current !== request) return;
      setDictionary(ar);
      setLanguageState("ar");
    });
  }

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    dir,
    setLanguage,
    t: (section) => dictionary[section],
  }), [dir, dictionary, language]);

  return React.createElement(LanguageContext.Provider, { value }, children);
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
