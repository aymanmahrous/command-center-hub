import type { RemoteMediaItem } from "./media-source-hub";

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID ?? "").trim();
const SOURCE = (import.meta.env.VITE_MASSIVE_ARCHIVE_DRIVE_FOLDER_URL ?? "").trim();
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

type TokenClient = { requestAccessToken: () => void };

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
};

function resolveFolderId(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return folderMatch?.[1] ?? (/^[a-zA-Z0-9_-]{10,}$/.test(value) ? value : "");
}

async function loadGoogleScript(): Promise<void> {
  if (typeof document === "undefined") return;
  if (window.google?.accounts?.oauth2) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-drive-identity="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("GOOGLE_SCRIPT_FAILED")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleDriveIdentity = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GOOGLE_SCRIPT_FAILED"));
    document.head.appendChild(script);
  });
}

async function driveList(token: string, folderId: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`,
    pageSize: "100",
    orderBy: "name",
    fields: "nextPageToken,files(id,name,mimeType,size,createdTime,webViewLink)",
  });
  const files: DriveFile[] = [];
  let pageToken = "";

  do {
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(typeof body?.error?.message === "string" ? body.error.message : `DRIVE_HTTP_${response.status}`);
    }
    const result = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(result.files ?? []));
    pageToken = result.nextPageToken ?? "";
  } while (pageToken);

  return files;
}

export function isGoogleDriveMediaConfigured(): boolean {
  return Boolean(CLIENT_ID && resolveFolderId(SOURCE));
}

export async function connectGoogleDriveForMedia(): Promise<string> {
  if (!isGoogleDriveMediaConfigured()) throw new Error("GOOGLE_DRIVE_NOT_CONFIGURED");
  await loadGoogleScript();
  if (!window.google?.accounts?.oauth2) throw new Error("GOOGLE_DRIVE_OAUTH_UNAVAILABLE");

  return new Promise<string>((resolve, reject) => {
    const client = window.google.accounts!.oauth2!.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "GOOGLE_DRIVE_CONNECT_FAILED"));
          return;
        }
        resolve(response.access_token);
      },
    });
    client.requestAccessToken();
  });
}

export async function fetchGoogleDriveMedia(token: string): Promise<RemoteMediaItem[]> {
  const folderId = resolveFolderId(SOURCE);
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_NOT_CONFIGURED");

  const files = await driveList(token, folderId);
  return files.map((file) => ({
    id: `google_drive:${file.id}`,
    provider: "google_drive" as const,
    name: file.name,
    mimeType: file.mimeType,
    webUrl: file.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`,
    sizeBytes: file.size ? Number(file.size) : undefined,
    createdAt: file.createdTime,
    folder: "Massive Archive",
    consent: "needs_review" as const,
  }));
}
