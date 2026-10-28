export function sanitizeCanvaEndpoint(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0];
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 1 && ["autofills", "exports", "asset-uploads"].includes(segments[0])) {
    return `/${segments[0]}`;
  }

  if (segments.length === 2 && ["autofills", "exports", "asset-uploads"].includes(segments[0])) {
    return `/${segments[0]}/:id`;
  }

  if (
    segments.length === 3 &&
    ["brand-templates", "designs"].includes(segments[0]) &&
    segments[2] === "dataset"
  ) {
    return `/${segments[0]}/:id/dataset`;
  }

  return "unclassified";
}

export function canvaFailureDiagnostic(path: string, response: Response) {
  return {
    endpoint: sanitizeCanvaEndpoint(path),
    status: response.status,
    requestId: response.headers.get("x-request-id") ?? response.headers.get("x-canva-request-id") ?? null,
  };
}


/** Keep uploaded asset names within Canva's 50-character limit. */
export function buildCanvaAssetName(contentItemId: string, extension: string): string {
  const compactId = contentItemId.replace(/[^a-zA-Z0-9]/g, "").slice(-12) || "asset";
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "png";
  return `coach-${compactId}.${safeExtension}`.slice(0, 50);
}
