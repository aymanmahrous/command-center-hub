const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
export const STAFF_MEDIA_BUCKET = "relax-fix-media";

type StaffStorageSession = { accessToken: string };

function encodedStoragePath(storagePath: string) {
  return storagePath.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
}

export function staffMediaObjectUrl(storagePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/${STAFF_MEDIA_BUCKET}/${encodedStoragePath(storagePath)}`;
}

export async function fetchStaffMediaBlob(session: StaffStorageSession, storagePath: string, signal?: AbortSignal) {
  const response = await fetch(staffMediaObjectUrl(storagePath), {
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: "no-store",
    signal,
  });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error(`STORAGE_READ_FAILED_${response.status}`);
  return response.blob();
}

export async function openStaffMediaAsset(session: StaffStorageSession, storagePath: string, fileName: string, mode: "open" | "download") {
  const blob = await fetchStaffMediaBlob(session, storagePath);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.rel = "noopener noreferrer";
  if (mode === "download") anchor.download = fileName;
  else anchor.target = "_blank";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
