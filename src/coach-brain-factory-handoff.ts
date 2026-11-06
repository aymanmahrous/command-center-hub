import type { CoachBrainFactoryContext } from "./content-batch-generator";

export const COACH_BRAIN_FACTORY_HANDOFF_KEY = "coach-brain-factory-handoff";

export type CoachBrainFactoryHandoff = CoachBrainFactoryContext & {
  /** Canonical, backward-compatible task contract fields consumed by orchestration. */
  userIntent: string;
  planStrategy: string;
  researchContext: { summary: string; sources: Array<{ title: string; url: string }> };
  requestedDuration: number | null;
  contentGoal: string;
  createdAt?: string;
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
  const suppliedResearch = raw.researchContext && typeof raw.researchContext === "object"
    ? raw.researchContext as Record<string, unknown>
    : {};
  const sample = raw.sample && typeof raw.sample === "object" ? raw.sample as Record<string, unknown> : {};
  const userIntent = boundedString(raw.userIntent, boundedString(raw.question, "", 1000), 1000);
  const researchSummary = boundedString(suppliedResearch.summary, boundedString(raw.answer, "", 4000), 4000);
  if (!userIntent || !researchSummary) return null;

  const contentGoal = boundedString(raw.contentGoal, boundedString(sample.topic, userIntent, 500), 500);
  const canonicalStrategy = boundedString(raw.planStrategy, "", 160);
  const strategyParts = canonicalStrategy.split(":");
  const planMix = boundedString(raw.planMix, strategyParts[0] || "varied", 80);
  const planExecution = boundedString(raw.planExecution, strategyParts[1] || "best", 40);
  const requestedDuration = boundedDuration(raw.requestedDuration) ?? boundedDuration(raw.planWindowDays);
  const planWindowDays = boundedDuration(raw.planWindowDays) ?? requestedDuration;

  const parseSources = (value: unknown) => Array.isArray(value)
    ? value.flatMap((source) => {
      if (!source || typeof source !== "object") return [];
      const item = source as Record<string, unknown>;
      if (typeof item.title !== "string" || typeof item.url !== "string") return [];
      return [{ title: item.title.trim().slice(0, 300), url: item.url.trim().slice(0, 2000) }];
    }).filter((source) => source.title && source.url).slice(0, 5)
    : [];
  const researchSources = parseSources(suppliedResearch.sources);
  const sources = parseSources(raw.sources);
  const normalizedSources = researchSources.length ? researchSources : sources;

  // The existing Factory consumes the legacy question field. Carry the canonical
  // content goal into that brief even when the producer also supplies question.
  const questionBase = boundedString(raw.question, userIntent, 1000);
  const goalAlreadyIncluded = questionBase.toLocaleLowerCase().includes(contentGoal.toLocaleLowerCase());
  const question = goalAlreadyIncluded || contentGoal === userIntent
    ? questionBase
    : `${questionBase}\nContent goal: ${contentGoal}`.slice(0, 1600);
  const answer = researchSummary;

  return {
    ...raw,
    question,
    answer,
    sources: normalizedSources,
    planWindowDays: planWindowDays ?? undefined,
    planMix,
    planExecution,
    userIntent,
    planStrategy: canonicalStrategy || `${planMix}:${planExecution}`,
    researchContext: {
      summary: researchSummary,
      sources: normalizedSources,
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
  // A failed write must not leave an older copy shadowing the successful fallback.
  if (!sessionSaved && localSaved) removeStorageValue("sessionStorage", COACH_BRAIN_FACTORY_HANDOFF_KEY, storageAccess);
  if (!localSaved && sessionSaved) removeStorageValue("localStorage", COACH_BRAIN_FACTORY_HANDOFF_KEY, storageAccess);
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
