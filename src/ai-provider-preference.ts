export type AiProviderPreference = "auto" | "gemini" | "openai";

const STORAGE_KEY = "relaxfix-ai-provider-preference-v1";

/** Stores only the owner's preferred content-generation provider on this device. Never stores credentials. */
export function readAiProviderPreference(): AiProviderPreference {
  try {
    if (typeof window === "undefined") return "auto";
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "gemini" || value === "openai" || value === "auto" ? value : "auto";
  } catch {
    return "auto";
  }
}

export function writeAiProviderPreference(value: AiProviderPreference): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Provider selection still works for the current screen if browser storage is unavailable.
  }
}
