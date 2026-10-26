export function sanitizeCanvaEndpoint(path: string): string {
  return path.replace(
    /^(\/(?:brand-templates|designs|autofills|exports|asset-uploads))\/[^/]+/,
    "$1/:id",
  );
}

export function canvaFailureDiagnostic(path: string, response: Response) {
  return {
    endpoint: sanitizeCanvaEndpoint(path),
    status: response.status,
    requestId: response.headers.get("x-request-id") ?? response.headers.get("x-canva-request-id") ?? null,
  };
}
