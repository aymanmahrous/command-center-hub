import type { CoachBrainFactoryContext } from "./content-batch-generator";

export const COACH_BRAIN_FACTORY_HANDOFF_KEY = "coach-brain-factory-handoff";

export type CoachBrainFactoryHandoff = CoachBrainFactoryContext & {
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

export function writeCoachBrainFactoryHandoff(value: string, access?: StorageAccess): boolean {
  const storageAccess = access ?? browserStorageAccess();
  const sessionSaved = writeStorageValue("sessionStorage", value, COACH_BRAIN_FACTORY_HANDOFF_KEY, storageAccess);
  const localSaved = writeStorageValue("localStorage", value, COACH_BRAIN_FACTORY_HANDOFF_KEY, storageAccess);
  return sessionSaved || localSaved;
}

export function readCoachBrainFactoryHandoff(access?: StorageAccess): CoachBrainFactoryHandoff | null {
  const storageAccess = access ?? browserStorageAccess();
  for (const name of ["sessionStorage", "localStorage"] as const) {
    const raw = readStorageValue(name, COACH_BRAIN_FACTORY_HANDOFF_KEY, storageAccess);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw) as Partial<CoachBrainFactoryHandoff>;
      if (typeof value.question !== "string" || typeof value.answer !== "string") continue;
      const sources = Array.isArray(value.sources)
        ? value.sources.filter((source): source is { title: string; url: string } => !!source && typeof source === "object" && typeof source.title === "string" && typeof source.url === "string").slice(0, 5)
        : [];
      return {
        question: value.question.slice(0, 1000),
        answer: value.answer.slice(0, 4000),
        sources,
        planWindowDays: typeof value.planWindowDays === "number" ? value.planWindowDays : undefined,
        planMix: typeof value.planMix === "string" ? value.planMix : undefined,
        planExecution: typeof value.planExecution === "string" ? value.planExecution : undefined,
      };
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
