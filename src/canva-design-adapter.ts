import type { ContentBatchItem } from "./content-batch";
import { parseCanvaBrief } from "./content-batch-media-preview";
import type { CanvaStatusDiagnostic } from "./canva-readiness";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

type CanvaDesignSession = { accessToken: string };

type CanvaDesignResponse = CanvaStatusDiagnostic & {
  success?: boolean;
  mediaAssetId?: string;
  canvaDesignUrl?: string;
  code?: string;
  imageApplied?: boolean;
};

async function callCanvaDesignEdge(session: CanvaDesignSession, body: Record<string, unknown>): Promise<CanvaDesignResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/canva-design`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  return (await response.json().catch(() => ({}))) as CanvaDesignResponse;
}

export async function fetchCanvaDesignStatus(session: CanvaDesignSession): Promise<CanvaStatusDiagnostic> {
  try {
    const result = await callCanvaDesignEdge(session, { mode: "status" });
    const ready = result.success === true && result.integrationStatus === "READY";
    return {
      ready,
      statusCheckFailed: result.success !== true,
      detail: result.detail ?? (ready ? "Canva design generation ready." : "Canva design generation not ready."),
      credentialsConfigured: result.credentialsConfigured,
      canvaConnected: result.canvaConnected,
      brandTemplateConfigured: result.brandTemplateConfigured,
      brandTemplateCount: result.brandTemplateCount,
      missingScopes: Array.isArray(result.missingScopes) ? result.missingScopes.filter((scope): scope is string => typeof scope === "string") : undefined,
      templateImageFieldCount: typeof result.templateImageFieldCount === "number" ? result.templateImageFieldCount : undefined,
      templateTextFieldCount: typeof result.templateTextFieldCount === "number" ? result.templateTextFieldCount : undefined,
      templateImageAutofillReady: result.templateImageAutofillReady,
      integrationStatus: result.integrationStatus,
      creativeReadiness: result.creativeReadiness,
      nextAction: result.nextAction,
    };
  } catch (cause) {
    if (cause instanceof Error && cause.message === "SESSION_EXPIRED") throw cause;
    return {
      ready: false,
      statusCheckFailed: true,
      detail: "Canva design status unavailable; no design generation was attempted.",
    };
  }
}

export async function generateCanvaDesignForContentItem(
  session: CanvaDesignSession,
  item: ContentBatchItem,
): Promise<{ mediaAssetId: string; canvaDesignUrl?: string; imageApplied: boolean }> {
  const result = await callCanvaDesignEdge(session, {
    mode: "generate",
    contentItemId: item.id,
    sourceMediaAssetId: typeof item.mediaAssetId === "string" ? item.mediaAssetId : "",
    topic: item.topic,
    hook: typeof item.hook === "string" ? item.hook : "",
    caption: item.caption,
    canvaBrief: parseCanvaBrief(typeof item.visualPrompt === "string" ? item.visualPrompt : undefined),
  });
  if (!result.success || !result.mediaAssetId) throw new Error(result.code ?? "CANVA_DESIGN_FAILED");
  return { mediaAssetId: result.mediaAssetId, canvaDesignUrl: result.canvaDesignUrl, imageApplied: result.imageApplied === true };
}

export function canvaDesignErrorMessage(code: string | undefined): string {
  switch (code) {
    case "CANVA_IMAGE_UPLOAD_FAILED":
    case "CANVA_IMAGE_UPLOAD_STATUS_FAILED":
    case "CANVA_IMAGE_UPLOAD_JOB_MISSING":
    case "CANVA_IMAGE_UPLOAD_TIMEOUT":
    case "CANVA_IMAGE_ASSET_MISSING":
      return "Canva could not import the linked library image. Check that the Canva connection has asset:write permission, then reconnect Canva if needed.";
    case "TEMPLATE_IMAGE_FIELD_MISSING":
      return "The selected Canva Brand Template has no image autofill field. It cannot change the main visual, so repeated-looking designs are expected. Add an image field to the template, publish it, and reconnect Canva if permissions changed.";
    case "MEDIA_ASSET_NOT_LINKED":
      return "Link the library image to this content item first, then create the Canva design.";
    case "IMAGE_ASSET_REQUIRED":
      return "Canva image autofill requires an image asset. Select an image rather than a video.";
    case "CANVA_NOT_CONNECTED":
      return "Connect Canva in Media Library first, then try again.";
    case "NEEDS_CREDENTIAL":
      return "Canva design automation is not configured on the server yet.";
    case "AUTOFILL_FAILED":
    case "AUTOFILL_TIMEOUT":
    case "EXPORT_FAILED":
    case "EXPORT_TIMEOUT":
      return "Canva could not finish the design this time. Try again in a moment.";
    default:
      return code ? `Canva design failed (${code}).` : "Canva design could not be generated.";
  }
}
