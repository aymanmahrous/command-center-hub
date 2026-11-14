import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
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
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());
  const [englishDictionary, setEnglishDictionary] = useState<Dictionary | null>(null);
  const dir: "rtl" | "ltr" = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [dir, language]);

  useEffect(() => {
    if (language !== "en" || englishDictionary) return;
    void import("./en").then((module) => {
      setEnglishDictionary(module.en);
    });
  }, [englishDictionary, language]);

  function setLanguage(next: Language) {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore persistence failures (private browsing, quota, etc.) */
    }
  }

  const value = useMemo<LanguageContextValue>(() => {
    const dictionary = language === "en" && englishDictionary ? englishDictionary : (ar as unknown as Dictionary);
    return {
      language,
      dir,
      setLanguage,
      t: (section) => dictionary[section],
    };
  }, [dir, englishDictionary, language]);

  return React.createElement(LanguageContext.Provider, { value }, children);
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
