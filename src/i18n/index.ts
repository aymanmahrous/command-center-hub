import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { en } from "./en";
import type { Dictionary } from "./en";

export type Language = "ar" | "en";
export type { Dictionary };

const STORAGE_KEY = "relaxfix-language";
const staticDictionaries: Partial<Record<Language, Dictionary>> = { en };

let arPromise: Promise<Dictionary> | undefined;

function loadArabic(): Promise<Dictionary> {
  if (!arPromise) {
    arPromise = import("./ar").then((m) => m.ar);
  }
  return arPromise;
}

if (typeof window !== "undefined") {
  const idle = typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback.bind(window)
    : (cb: () => void) => window.setTimeout(cb, 200);
  idle(() => { void loadArabic().catch(() => { arPromise = undefined; }); });
}

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

function toDictionary(value: unknown): Dictionary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid dictionary payload");
  }
  return value as Dictionary;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());
  const [loaded, setLoaded] = useState<Partial<Record<Language, Dictionary>>>(staticDictionaries);
  const dir: "rtl" | "ltr" = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [dir, language]);

  useEffect(() => {
    if (loaded[language]) return;
    let cancelled = false;
    void loadArabic()
      .then((dictionary) => {
        if (!cancelled) setLoaded((prev) => ({ ...prev, [language]: dictionary }));
      })
      .catch(() => {
        if (!cancelled) setLoaded((prev) => ({ ...prev, [language]: toDictionary({}) }));
      });
    return () => { cancelled = true; };
  }, [language, loaded]);

  function setLanguage(next: Language) {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore persistence failures (private browsing, quota, etc.) */
    }
  }

  const value = useMemo<LanguageContextValue>(() => {
    const dictionary = loaded[language] ?? staticDictionaries[language] ?? en;
    return {
      language,
      dir,
      setLanguage,
      t: (section) => dictionary[section],
    };
  }, [language, loaded, dir]);

  return React.createElement(LanguageContext.Provider, { value }, children);
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
