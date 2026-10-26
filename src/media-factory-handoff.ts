import type { MediaAssetRecord } from "./media-types";

export const MEDIA_FACTORY_HANDOFF_KEY = "media-factory-handoff";

export type MediaFactoryHandoff = {
  asset: {
    id: string;
    provider: string;
    name: string;
    mimeType: string;
    webUrl: string | null;
    previewUrl: string | null;
    folder: string;
  };
  createdAt: string;
};

function safeHttpsUrl(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}

function resolveAssetName(asset: MediaAssetRecord): string {
  for (const key of ["file_name", "fileName", "originalName", "name", "title"]) {
    const value = asset.metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return asset.storagePath?.split("/").filter(Boolean).at(-1) || "Media asset";
}

export function createMediaFactoryHandoff(asset: MediaAssetRecord, createdAt = new Date().toISOString()): MediaFactoryHandoff {
  const metadata = asset.metadata ?? {};
  const webUrl = safeHttpsUrl(asset.webUrl) ?? safeHttpsUrl(metadata.external_web_url);
  const mimeType = typeof asset.mimeType === "string"
    ? asset.mimeType
    : typeof metadata.mime_type === "string"
      ? metadata.mime_type
      : typeof metadata.mimeType === "string"
        ? metadata.mimeType
        : "application/octet-stream";

  return {
    asset: {
      id: asset.id,
      provider: typeof asset.provider === "string" ? asset.provider : asset.source,
      name: typeof asset.name === "string" && asset.name.trim() ? asset.name.trim() : resolveAssetName(asset),
      mimeType,
      webUrl,
      previewUrl: safeHttpsUrl(asset.previewUrl),
      folder: typeof asset.folder === "string"
        ? asset.folder
        : typeof metadata.folder === "string"
          ? metadata.folder
          : "",
    },
    createdAt,
  };
}

export function parseMediaFactoryHandoff(raw: unknown): MediaFactoryHandoff | null {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) as Partial<MediaFactoryHandoff> : raw as Partial<MediaFactoryHandoff>;
    if (!value || typeof value !== "object" || !value.asset || typeof value.asset !== "object") return null;
    const asset = value.asset as Partial<MediaFactoryHandoff["asset"]>;
    if (typeof asset.id !== "string" || !asset.id || typeof asset.name !== "string" || !asset.name.trim()) return null;
    if (asset.webUrl !== null && asset.webUrl !== undefined && typeof asset.webUrl !== "string") return null;

    return {
      asset: {
        id: asset.id,
        provider: typeof asset.provider === "string" ? asset.provider : "unknown",
        name: asset.name.trim(),
        mimeType: typeof asset.mimeType === "string" ? asset.mimeType : "application/octet-stream",
        webUrl: safeHttpsUrl(asset.webUrl),
        previewUrl: safeHttpsUrl(asset.previewUrl),
        folder: typeof asset.folder === "string" ? asset.folder : "",
      },
      createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    };
  } catch {
    return null;
  }
}
