#!/usr/bin/env node
/**
 * Controlled Google Drive -> Supabase Storage import for existing media_assets rows.
 *
 * - Staff JWT only (no service_role for DB writes).
 * - Bucket: relax-fix-media (must already exist).
 * - Updates storage_path via update_staff_media_asset_storage_path RPC.
 * - Processes ONE asset by default; set MEDIA_ASSET_ID to target a specific row.
 * - Supports image (existing) and document/other assets (PDF, DOCX).
 *
 * Required env:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)
 *   STAFF_EMAIL
 *   STAFF_PASSWORD
 *   GOOGLE_DRIVE_ACCESS_TOKEN
 *
 * Optional env:
 *   MEDIA_ASSET_ID   — import exactly this asset (controlled test)
 *   DRY_RUN=1        — list candidate only, no download/upload/write
 */

import { createHash } from "node:crypto";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_KEY = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
const STAFF_EMAIL = (process.env.STAFF_EMAIL ?? "").trim();
const STAFF_PASSWORD = process.env.STAFF_PASSWORD ?? "";
const DRIVE_TOKEN = (process.env.GOOGLE_DRIVE_ACCESS_TOKEN ?? "").trim();
const TARGET_MEDIA_ASSET_ID = (process.env.MEDIA_ASSET_ID ?? "").trim();
const DRY_RUN = process.env.DRY_RUN === "1";

const MEDIA_BUCKET = "relax-fix-media";
const RPC_UPDATE_STORAGE = "update_staff_media_asset_storage_path";

const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function decodeJwtPayload(token) {
  const part = token.split(".")[1];
  if (!part) throw new Error("INVALID_JWT");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function staffLogin() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(`STAFF_LOGIN_FAILED:${response.status}:${body.error_description ?? body.msg ?? "unknown"}`);
  return { accessToken: body.access_token, userId: body.user?.id ?? decodeJwtPayload(body.access_token).sub };
}

async function rpc(accessToken, name, payload = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body === "object" ? JSON.stringify(body) : String(body ?? "");
    throw new Error(`RPC_${name}_HTTP_${response.status}:${detail}`);
  }
  return body;
}

function driveFileId(asset) {
  const candidates = [
    asset.providerJobId,
    asset.metadata?.driveFileId,
    asset.metadata?.googleDriveFileId,
    asset.metadata?.fileId,
    asset.metadata?.drive_file_id,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function storageSegmentForAsset(asset) {
  if (asset.assetType === "other") return "document";
  if (asset.assetType === "video") return "video";
  return "image";
}

function extensionFor(mimeType, fileName, assetType) {
  const fromName = typeof fileName === "string" ? fileName.split(".").pop()?.toLowerCase() : "";
  if (fromName && DOCUMENT_EXTENSIONS.has(fromName)) return fromName;
  if (fromName && IMAGE_EXTENSIONS.has(fromName)) return fromName === "jpeg" ? "jpg" : fromName;

  if (assetType === "other" || mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function destinationPath({ userId, asset, mediaAssetId, extension }) {
  const segment = storageSegmentForAsset(asset);
  const scope = asset.contentItemId ?? "library";
  return `${userId}/${segment}/${scope}/drive-import-${mediaAssetId}.${extension}`;
}

function encodedObjectPath(path) {
  return path.split("/").filter(Boolean).map((s) => encodeURIComponent(s)).join("/");
}

async function fetchDriveFile(fileId) {
  const metaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`, {
    headers: { Authorization: `Bearer ${DRIVE_TOKEN}` },
  });
  const meta = await metaResponse.json().catch(() => ({}));
  if (!metaResponse.ok) throw new Error(`DRIVE_META_${metaResponse.status}:${meta.error?.message ?? "unknown"}`);

  const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${DRIVE_TOKEN}` },
  });
  if (!downloadResponse.ok) throw new Error(`DRIVE_DOWNLOAD_${downloadResponse.status}`);
  const bytes = new Uint8Array(await downloadResponse.arrayBuffer());
  const mimeType = (downloadResponse.headers.get("content-type") ?? meta.mimeType ?? "application/octet-stream").split(";")[0].trim();
  return { bytes, mimeType, fileName: meta.name ?? null, driveFileId: fileId, sizeBytes: bytes.byteLength };
}

async function storageHead(accessToken, objectPath) {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${encodedObjectPath(objectPath)}`, {
    method: "HEAD",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
  });
  return response.ok;
}

async function storageUpload(accessToken, objectPath, bytes, contentType) {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${encodedObjectPath(objectPath)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
      "x-upsert": "false",
      "Cache-Control": "max-age=3600",
    },
    body: bytes,
  });
  if (response.ok) return;
  const detail = await response.text();
  if (/already exists|duplicate/i.test(detail) && await storageHead(accessToken, objectPath)) return;
  throw new Error(`STORAGE_UPLOAD_${response.status}:${detail.slice(0, 500)}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pickCandidate(assets) {
  const pending = assets.filter((asset) => {
    if (asset.provider !== "google_drive") return false;
    if (asset.storagePath) return false;
    if (!driveFileId(asset)) return false;
    if (asset.assetType === "other") return true;
    return Boolean(asset.contentItemId);
  });
  if (TARGET_MEDIA_ASSET_ID) {
    const match = pending.find((asset) => asset.id === TARGET_MEDIA_ASSET_ID);
    if (!match) fail(`TARGET_MEDIA_ASSET_NOT_FOUND_OR_NOT_ELIGIBLE:${TARGET_MEDIA_ASSET_ID}`);
    return match;
  }
  if (pending.length === 0) fail("NO_ELIGIBLE_GOOGLE_DRIVE_ASSETS");
  pending.sort((a, b) => a.id.localeCompare(b.id));
  return pending[0];
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) fail("MISSING_SUPABASE_CONFIG");
  if (!STAFF_EMAIL || !STAFF_PASSWORD) fail("MISSING_STAFF_CREDENTIALS");
  if (!DRY_RUN && !DRIVE_TOKEN) fail("MISSING_GOOGLE_DRIVE_ACCESS_TOKEN");

  const session = await staffLogin();
  const discoveryPayload = TARGET_MEDIA_ASSET_ID ? { p_media_asset_id: TARGET_MEDIA_ASSET_ID } : {};
  const assets = await rpc(session.accessToken, "get_staff_google_drive_import_candidates", discoveryPayload);
  if (!Array.isArray(assets)) fail("INVALID_MEDIA_ASSETS_RESPONSE");

  const asset = pickCandidate(assets);
  const sourceDriveFileId = driveFileId(asset);

  if (DRY_RUN) {
    console.log(JSON.stringify({
      mode: "dry_run",
      contentItemId: asset.contentItemId,
      mediaAssetId: asset.id,
      assetType: asset.assetType,
      sourceDriveFileId,
      provider: asset.provider,
      storagePath: asset.storagePath,
      eligiblePendingCount: assets.filter((a) => {
        if (a.provider !== "google_drive" || a.storagePath || !driveFileId(a)) return false;
        return a.assetType === "other" || a.contentItemId;
      }).length,
    }, null, 2));
    return;
  }

  const drive = await fetchDriveFile(sourceDriveFileId);
  const extension = extensionFor(drive.mimeType, drive.fileName, asset.assetType);
  const objectPath = destinationPath({
    userId: session.userId,
    asset,
    mediaAssetId: asset.id,
    extension,
  });

  if (await storageHead(session.accessToken, objectPath)) {
    fail(`DESTINATION_ALREADY_EXISTS:${objectPath}`);
  }

  await storageUpload(session.accessToken, objectPath, drive.bytes, drive.mimeType);
  if (!(await storageHead(session.accessToken, objectPath))) {
    fail(`UPLOAD_VERIFICATION_FAILED:${objectPath}`);
  }

  const linked = await rpc(session.accessToken, RPC_UPDATE_STORAGE, {
    p_media_asset_id: asset.id,
    p_storage_path: objectPath,
  });

  if (!linked?.success) {
    fail(`RPC_LINK_FAILED:${JSON.stringify(linked)}`);
  }

  console.log(JSON.stringify({
    success: true,
    contentItemId: asset.contentItemId,
    mediaAssetId: asset.id,
    assetType: asset.assetType,
    sourceDriveFile: drive.fileName ?? sourceDriveFileId,
    sourceDriveFileId,
    destinationStoragePath: objectPath,
    fileExistenceVerified: true,
    checksumSha256: sha256(drive.bytes),
    sizeBytes: drive.sizeBytes,
    mimeType: drive.mimeType,
    publishingPerformed: false,
  }, null, 2));
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
