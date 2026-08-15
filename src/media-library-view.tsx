import { useEffect, useMemo, useState } from "react";
import { Library } from "lucide-react";
import { z } from "zod";
import { useLanguage } from "./i18n";
import type { Dictionary, Language } from "./i18n";
import { fetchStaffMediaBlob, openStaffMediaAsset } from "./staff-media-storage";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type MediaAssetType = "image" | "video" | "logo" | "other";
type MediaSource = "upload" | "ai_generated" | "external";
type MediaLibrarySession = { accessToken: string };

const MediaAssetSchema = z.object({
  id: z.string().uuid(), createdBy: z.string().uuid().nullable(), contentItemId: z.string().uuid().nullable(),
  assetType: z.enum(["image", "video", "logo", "other"]), source: z.enum(["upload", "ai_generated", "external"]),
  storagePath: z.string().nullable(), provider: z.string().nullable(), providerJobId: z.string().nullable(),
  prompt: z.string().nullable(), metadata: z.record(z.unknown()), createdAt: z.string(),
}).passthrough();

const mediaTypeLabels: Record<Language, Record<MediaAssetType, string>> = {
  ar: { image: "صورة", video: "فيديو", logo: "شعار", other: "مستند" },
  en: { image: "Image", video: "Video", logo: "Logo", other: "Document" },
};
const mediaSourceLabels: Record<Language, Record<MediaSource, string>> = {
  ar: { upload: "رفع موظف", ai_generated: "مولّد بالذكاء الاصطناعي", external: "مصدر خارجي" },
  en: { upload: "Staff upload", ai_generated: "AI generated", external: "External source" },
};

function formatBookingDateTime(language: Language, value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(language === "ar" ? "ar-AE" : "en-AE");
}

function mediaFileName(language: Language, copy: Dictionary["media"], storagePath: string | null, metadata: Record<string, unknown> = {}) {
  const metadataName = typeof metadata.file_name === "string" ? metadata.file_name.trim() : "";
  if (metadataName) return metadataName;
  if (!storagePath) return copy.noSavedFile;
  return storagePath.split("/").filter(Boolean).at(-1) ?? copy.privateFile;
}

function mediaPreviewHint(language: Language, copy: Dictionary["media"], assetType: MediaAssetType) {
  if (assetType === "video") return language === "ar" ? "معاينة خاصة غير مكشوفة" : "Private preview, not disclosed";
  if (assetType === "other") return copy.documentPreviewPrivate;
  return language === "ar" ? "معاينة خاصة غير مكشوفة" : "Private preview, not disclosed";
}

function mediaMetadataSummary(copy: Dictionary["media"], metadata: Record<string, unknown>, provider: string | null = null) {
  const hiddenKeys = new Set(["drive_file_id", "driveFileId", "googleDriveFileId", "fileId"]);
  const entries = Object.entries(metadata).filter(([key]) => !(provider === "google_drive" && hiddenKeys.has(key)));
  if (entries.length === 0) return copy.noMetadata;
  return entries.slice(0, 6).map(([key, value]) => {
    const rendered = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : copy.compositeData;
    return `${key.replaceAll("_", " ")}: ${rendered.slice(0, 120)}`;
  }).join(" · ");
}

function mediaProviderJobLabel(copy: Dictionary["media"], unavailable: string, provider: string | null, providerJobId: string | null) {
  if (!providerJobId) return unavailable;
  if (provider === "google_drive") return copy.privateExternalReference;
  return providerJobId;
}

function MediaAssetPreview({
  asset,
  copy,
  language,
  session,
  typeLabels,
  onSessionExpired,
  loadingLabel,
}: {
  asset: z.infer<typeof MediaAssetSchema>;
  copy: Dictionary["media"];
  language: Language;
  session: MediaLibrarySession;
  typeLabels: Record<MediaAssetType, string>;
  onSessionExpired: () => void;
  loadingLabel: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [actionBusy, setActionBusy] = useState<"open" | "download" | null>(null);
  const [actionError, setActionError] = useState("");
  const fileName = mediaFileName(language, copy, asset.storagePath, asset.metadata);
  const canPreviewImage = Boolean(asset.storagePath) && (asset.assetType === "image" || asset.assetType === "logo");
  const isDocument = asset.assetType === "other";

  useEffect(() => {
    if (!canPreviewImage || !asset.storagePath) {
      setPreviewUrl(null);
      setPreviewState("idle");
      return;
    }
    const controller = new AbortController();
    setPreviewState("loading");
    fetchStaffMediaBlob(session, asset.storagePath, controller.signal)
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setPreviewState("ready");
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        const code = cause instanceof Error ? cause.message : "PREVIEW_FAILED";
        if (code === "SESSION_EXPIRED") onSessionExpired();
        setPreviewState("error");
      });
    return () => {
      controller.abort();
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, [asset.id, asset.storagePath, canPreviewImage, onSessionExpired, session]);

  async function handleDocumentAction(mode: "open" | "download") {
    if (!asset.storagePath || actionBusy) return;
    setActionBusy(mode);
    setActionError("");
    try {
      await openStaffMediaAsset(session, asset.storagePath, fileName, mode);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "DOCUMENT_ACTION_FAILED";
      if (code === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setActionError(copy.documentActionFailed);
    } finally {
      setActionBusy(null);
    }
  }

  if (canPreviewImage && previewState === "ready" && previewUrl) {
    return <div className="media-preview media-preview-image"><img src={previewUrl} alt={fileName} loading="lazy" decoding="async" /></div>;
  }

  return <div className={`media-placeholder media-${asset.assetType}`}>
    {canPreviewImage && previewState === "loading" ? <span>{loadingLabel}</span> : <Library size={26} />}
    <span>{typeLabels[asset.assetType]}</span>
    <small>{canPreviewImage && previewState === "error" ? copy.previewUnavailable : mediaPreviewHint(language, copy, asset.assetType)}</small>
    {isDocument && asset.storagePath && <div className="media-document-actions">
      <button type="button" disabled={actionBusy !== null} onClick={() => void handleDocumentAction("open")}>{actionBusy === "open" ? loadingLabel : copy.documentOpen}</button>
      <button type="button" className="secondary" disabled={actionBusy !== null} onClick={() => void handleDocumentAction("download")}>{actionBusy === "download" ? loadingLabel : copy.documentDownload}</button>
    </div>}
    {actionError && <small className="media-action-error">{actionError}</small>}
  </div>;
}

export function MediaLibraryView({ value, session, onSessionExpired }: { value: JsonValue; session: MediaLibrarySession; onSessionExpired: () => void }) {
  const { language, t } = useLanguage();
  const copy = t("media");
  const typeLabels = mediaTypeLabels[language];
  const sourceLabels = mediaSourceLabels[language];
  const parsed = useMemo(() => z.array(MediaAssetSchema).safeParse(value), [value]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaAssetType | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<MediaSource | "all">("all");
  const assets = parsed.success ? parsed.data : [];
  const counts = useMemo(() => {
    const initial: Record<MediaAssetType, number> = { image: 0, video: 0, logo: 0, other: 0 };
    for (const asset of assets) initial[asset.assetType] += 1;
    return initial;
  }, [assets]);
  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    return assets.filter((asset) => {
      if (typeFilter !== "all" && asset.assetType !== typeFilter) return false;
      if (sourceFilter !== "all" && asset.source !== sourceFilter) return false;
      if (!normalized) return true;
      return [mediaFileName(language, copy, asset.storagePath, asset.metadata), asset.provider, asset.prompt, asset.contentItemId, mediaMetadataSummary(copy, asset.metadata, asset.provider)]
        .filter((field): field is string => Boolean(field))
        .some((field) => field.toLocaleLowerCase("ar").includes(normalized));
    });
  }, [assets, copy, language, query, sourceFilter, typeFilter]);

  if (!parsed.success) return <div className="error-box">{copy.invalidFormat}</div>;

  return <>
    <div className="media-security-banner compact"><span>{language === "ar" ? "مكتبة وسائط خاصة للقراءة فقط" : "Private read-only media library"}</span></div>
    <div className="media-summary" aria-label={language === "ar" ? "ملخص أنواع الوسائط" : "Media type summary"}>
      <button type="button" className={typeFilter === "all" ? "active" : ""} onClick={() => setTypeFilter("all")}><span>{copy.allLabel}</span><strong>{assets.length}</strong></button>
      {(Object.keys(typeLabels) as MediaAssetType[]).map((type) => <button type="button" key={type} className={typeFilter === type ? "active" : ""} onClick={() => setTypeFilter(type)}><span>{typeLabels[type]}</span><strong>{counts[type]}</strong></button>)}
    </div>
    <div className="media-toolbar">
      <label>{t("common").search}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} /></label>
      <label>{copy.sourceLabel}<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as MediaSource | "all")}><option value="all">{copy.allSources}</option>{(Object.keys(sourceLabels) as MediaSource[]).map((source) => <option key={source} value={source}>{sourceLabels[source]}</option>)}</select></label>
      <span>{filteredAssets.length} {t("common").of} {assets.length}</span>
    </div>
    {assets.length === 0 && <p className="muted">{copy.noAssets}</p>}
    {assets.length > 0 && filteredAssets.length === 0 && <p className="muted">{copy.noResults}</p>}
    <div className="media-grid">{filteredAssets.map((asset) => <article className="media-card" key={asset.id}>
      <MediaAssetPreview asset={asset} copy={copy} language={language} session={session} typeLabels={typeLabels} onSessionExpired={onSessionExpired} loadingLabel={t("common").loading} />
      <div className="media-details">
        <header><div><span>{sourceLabels[asset.source]}</span><h3>{mediaFileName(language, copy, asset.storagePath, asset.metadata)}</h3></div><span className="private-badge">{copy.privateBadge}</span></header>
        <dl>
          <div><dt>{copy.providerLabel}</dt><dd>{asset.provider || copy.internalUnspecified}</dd></div>
          <div><dt>{copy.createdLabel}</dt><dd>{formatBookingDateTime(language, asset.createdAt)}</dd></div>
          <div><dt>{copy.contentItemLabel}</dt><dd>{asset.contentItemId ?? t("common").unlinked}</dd></div>
          <div><dt>{copy.providerJobLabel}</dt><dd>{mediaProviderJobLabel(copy, t("common").unavailable, asset.provider, asset.providerJobId)}</dd></div>
        </dl>
        {asset.prompt && <div className="media-prompt"><strong>{copy.generationDescription}</strong><p>{asset.prompt}</p></div>}
        <p className="media-metadata">{mediaMetadataSummary(copy, asset.metadata, asset.provider)}</p>
      </div>
    </article>)}</div>
  </>;
}
