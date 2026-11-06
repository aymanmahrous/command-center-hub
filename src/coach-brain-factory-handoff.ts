import type { CoachBrainFactoryContext } from "./content-batch-generator";

export const COACH_BRAIN_FACTORY_HANDOFF_KEY = "coach-brain-factory-handoff";

export type CoachBrainFactoryHandoff = CoachBrainFactoryContext & {
  /** Canonical, backward-compatible task contract fields consumed by orchestration. */
  userIntent: string;
  planStrategy: string;
  researchContext: { summary: string; sources: Array<{ title: string; url: string }> };
  requestedDuration: number | null;
  contentGoal: string;
  /** Legacy Factory fields remain available during migration. */
  planWindowDays?: number;
  planMix?: string;
  planExecution?: string;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type StorageName = "sessionStorage" | "localStorage";

export type StorageAccess = Partial<Record<StorageName, StorageLike | null>>;

export function browserStorageAccess(): StorageAccess {
  return {
    get sessionStorage() {
      try { return globalThis.sessionStorage; } catch { return null; }
    },
    get localStorage() {
      try { return globalThis.localStorage; } catch { return null; }
    },
  };
}

function readStorage(access: StorageAccess, name: StorageName): StorageLike | null {
  try { return access[name] ?? null; } catch { return null; }
}

export function readStorageValue(
  name: StorageName,
  key = COACH_BRAIN_FACTORY_HANDOFF_KEY,
  access: StorageAccess = browserStorageAccess(),
): string | null {
  try { return readStorage(access, name)?.getItem(key) ?? null; } catch { return null; }
}

export function writeStorageValue(
  name: StorageName,
  value: string,
  key = COACH_BRAIN_FACTORY_HANDOFF_KEY,
  access: StorageAccess = browserStorageAccess(),
): boolean {
  try {
    const storage = readStorage(access, name);
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch { return false; }
}

export function removeStorageValue(
  name: StorageName,
  key = COACH_BRAIN_FACTORY_HANDOFF_KEY,
  access: StorageAccess = browserStorageAccess(),
): boolean {
  try {
    const storage = readStorage(access, name);
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch { return false; }
}

function boundedString(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function boundedDuration(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(2, Math.min(30, Math.round(value)));
}

function normalizeHandoff(value: unknown): CoachBrainFactoryHandoff | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.question !== "string" || typeof raw.answer !== "string") return null;

  const question = raw.question.trim().slice(0, 1000);
  const answer = raw.answer.trim().slice(0, 4000);
  if (!question || !answer) return null;

  const sources = Array.isArray(raw.sources)
    ? raw.sources.flatMap((source) => {
      if (!source || typeof source !== "object") return [];
      const item = source as Record<string, unknown>;
      if (typeof item.title !== "string" || typeof item.url !== "string") return [];
      return [{ title: item.title.trim().slice(0, 300), url: item.url.trim().slice(0, 2000) }];
    }).filter((source) => source.title && source.url).slice(0, 5)
    : [];

  const planWindowDays = boundedDuration(raw.planWindowDays);
  const requestedDuration = boundedDuration(raw.requestedDuration) ?? planWindowDays;
  const planMix = boundedString(raw.planMix, "varied", 80);
  const planExecution = boundedString(raw.planExecution, "best", 40);
  const suppliedResearch = raw.researchContext && typeof raw.researchContext === "object"
    ? raw.researchContext as Record<string, unknown>
    : {};

  const researchSources = Array.isArray(suppliedResearch.sources)
    ? suppliedResearch.sources.flatMap((source) => {
      if (!source || typeof source !== "object") return [];
      const item = source as Record<string, unknown>;
      if (typeof item.title !== "string" || typeof item.url !== "string") return [];
      return [{ title: item.title.trim().slice(0, 300), url: item.url.trim().slice(0, 2000) }];
    }).filter((source) => source.title && source.url).slice(0, 5)
    : sources;

  const sample = raw.sample && typeof raw.sample === "object" ? raw.sample as Record<string, unknown> : {};
  const contentGoal = boundedString(raw.contentGoal, boundedString(sample.topic, question, 500), 500);

  return {
    ...raw,
    question,
    answer,
    sources,
    planWindowDays: planWindowDays ?? undefined,
    planMix,
    planExecution,
    userIntent: boundedString(raw.userIntent, question, 1000),
    planStrategy: boundedString(raw.planStrategy, `${planMix}:${planExecution}`, 160),
    researchContext: {
      summary: boundedString(suppliedResearch.summary, answer, 4000),
      sources: researchSources,
    },
    requestedDuration,
    contentGoal,
  } as CoachBrainFactoryHandoff;
}

export function writeCoachBrainFactoryHandoff(value: string, access?: StorageAccess): boolean {
  const storageAccess = access ?? browserStorageAccess();
  let normalizedValue = value;
  try {
    const normalized = normalizeHandoff(JSON.parse(value));
    if (normalized) normalizedValue = JSON.stringify(normalized);
  } catch { /* Preserve the existing safe failure behavior for malformed input. */ }
  const sessionSaved = writeStorageValue("sessionStorage", normalizedValue, COACH_BRAIN_FACTORY_HANDOFF_KEY, storageAccess);
  const localSaved = writeStorageValue("localStorage", normalizedValue, COACH_BRAIN_FACTORY_HANDOFF_KEY, storageAccess);
  return sessionSaved || localSaved;
}

export function readCoachBrainFactoryHandoff(access?: StorageAccess): CoachBrainFactoryHandoff | null {
  const storageAccess = access ?? browserStorageAccess();
  for (const name of ["sessionStorage", "localStorage"] as const) {
    const raw = readStorageValue(name, COACH_BRAIN_FACTORY_HANDOFF_KEY, storageAccess);
    if (!raw) continue;
    try {
      const value = normalizeHandoff(JSON.parse(raw));
      if (value) return value;
    } catch { /* Try the fallback storage. */ }
  }
  return null;
}

export function clearCoachBrainFactoryHandoff(access?: StorageAccess): boolean {
  const storageAccess = access ?? browserStorageAccess();
  const sessionRemoved = removeStorageValue("sessionStorage", COACH_BRAIN_FACTORY_HANDOFF_KEY, storageAccess);
  const localRemoved = removeStorageValue("localStorage", COACH_BRAIN_FACTORY_HANDOFF_KEY, storageAccess);
  return sessionRemoved || localRemoved;
}
