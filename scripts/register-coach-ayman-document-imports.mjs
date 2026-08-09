#!/usr/bin/env node
/**
 * Register the three owner-approved Coach Ayman professional documents as
 * google_drive import candidates (asset_type=other) via staff RPC only.
 *
 * Required env:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)
 *   STAFF_EMAIL
 *   STAFF_PASSWORD
 *
 * Optional env:
 *   DRY_RUN=1
 */

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_KEY = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
const STAFF_EMAIL = (process.env.STAFF_EMAIL ?? "").trim();
const STAFF_PASSWORD = process.env.STAFF_PASSWORD ?? "";
const DRY_RUN = process.env.DRY_RUN === "1";

const APPROVED_DOCUMENTS = [
  {
    driveFileId: "1MXzAHqFGJRINmlCzUeVswirk6cxUlTYF",
    fileName: "01_Ayman_Mahrous_CV_Bilingual.docx",
    metadata: {
      approval: "READY_TO_USE",
      library_pack: "coach_ayman_profile",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  },
  {
    driveFileId: "17vDhx9MevwVLTUP7wFh_MxRbcgKZxUPI",
    fileName: "02_Ayman_Mahrous_Swimming_Coach_Profile_Print.pdf",
    metadata: {
      approval: "READY_TO_USE",
      library_pack: "coach_ayman_profile",
      mime_type: "application/pdf",
    },
  },
  {
    driveFileId: "1pI9Oa8ua-ffxTDShj5gaE4O0_Im9bBRD",
    fileName: "03_Ayman_Mahrous_FINAL_Saudi_CV_2026.pdf",
    metadata: {
      approval: "READY_TO_USE",
      library_pack: "coach_ayman_profile",
      mime_type: "application/pdf",
    },
  },
];

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

async function staffLogin() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(`STAFF_LOGIN_FAILED:${response.status}:${body.error_description ?? body.msg ?? "unknown"}`);
  return body.access_token;
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

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) fail("MISSING_SUPABASE_CONFIG");
  if (!STAFF_EMAIL || !STAFF_PASSWORD) fail("MISSING_STAFF_CREDENTIALS");

  if (DRY_RUN) {
    console.log(JSON.stringify({ mode: "dry_run", documents: APPROVED_DOCUMENTS }, null, 2));
    return;
  }

  const accessToken = await staffLogin();
  const results = [];

  for (const document of APPROVED_DOCUMENTS) {
    const registered = await rpc(accessToken, "register_staff_google_drive_document_import_candidate", {
      p_drive_file_id: document.driveFileId,
      p_file_name: document.fileName,
      p_metadata: document.metadata,
    });
    results.push({ fileName: document.fileName, driveFileId: document.driveFileId, ...registered });
  }

  console.log(JSON.stringify({ success: true, registered: results }, null, 2));
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
