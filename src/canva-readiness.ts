export type CanvaCapabilityState = "AVAILABLE" | "LIMITED" | "BLOCKED" | "NOT_CONFIGURED";
export type CanvaReadinessState = "NOT_CONNECTED" | "CHECKING" | "CONNECTED_NOT_READY" | "READY" | "CHECK_FAILED" | "CONNECTION_MISMATCH";
export type DesignProvider = "auto" | "canva" | "gemini" | "chatgpt" | "runway" | "capcut" | "manual";

export type CanvaStatusDiagnostic = {
  ready: boolean;
  detail: string;
  statusCheckFailed?: boolean;
  credentialsConfigured?: boolean;
  canvaConnected?: boolean;
  brandTemplateConfigured?: boolean;
  brandTemplateCount?: number;
  missingScopes?: string[];
  templateImageFieldCount?: number;
  templateTextFieldCount?: number;
  templateImageAutofillReady?: boolean;
  integrationStatus?: string;
  creativeReadiness?: string;
  nextAction?: string;
};

export type CanvaReadiness = {
  integrationConnected: boolean;
  providerConnected: boolean | null;
  ready: boolean;
  capabilityState: CanvaCapabilityState;
  readinessState: CanvaReadinessState;
  connectionLabel: string;
  readinessLabel: string;
  detail: string;
};

export function assessCanvaReadiness(
  integrationStatus: string | undefined,
  status: CanvaStatusDiagnostic | null,
): CanvaReadiness {
  const integrationConnected = integrationStatus === "connected";
  const providerConnected = typeof status?.canvaConnected === "boolean" ? status.canvaConnected : null;
  const detail = status?.detail || (integrationConnected
    ? "Canva readiness could not be verified."
    : "Canva is not connected.");

  if (!integrationConnected) {
    return {
      integrationConnected: false,
      providerConnected,
      ready: false,
      capabilityState: "NOT_CONFIGURED",
      readinessState: "NOT_CONNECTED",
      connectionLabel: "Not connected",
      readinessLabel: "Not ready",
      detail,
    };
  }

  if (!status) {
    return {
      integrationConnected: true,
      providerConnected,
      ready: false,
      capabilityState: "LIMITED",
      readinessState: "CHECKING",
      connectionLabel: "OAuth connection recorded; provider check pending",
      readinessLabel: "Checking",
      detail,
    };
  }

  if (status.statusCheckFailed) {
    return {
      integrationConnected: true,
      providerConnected,
      ready: false,
      capabilityState: "BLOCKED",
      readinessState: "CHECK_FAILED",
      connectionLabel: providerConnected === false ? "Provider not connected" : "Connection check failed",
      readinessLabel: "Unknown — check failed",
      detail,
    };
  }

  if (providerConnected === false) {
    return {
      integrationConnected: true,
      providerConnected: false,
      ready: false,
      capabilityState: "BLOCKED",
      readinessState: "CONNECTION_MISMATCH",
      connectionLabel: "Integration record connected; provider token unavailable",
      readinessLabel: "Not ready",
      detail,
    };
  }

  if (status.ready === true && status.integrationStatus === "READY") {
    return {
      integrationConnected: true,
      providerConnected: providerConnected ?? true,
      ready: true,
      capabilityState: "AVAILABLE",
      readinessState: "READY",
      connectionLabel: "Connected",
      readinessLabel: "Ready for design",
      detail,
    };
  }

  return {
    integrationConnected: true,
    providerConnected: providerConnected ?? true,
    ready: false,
    capabilityState: "LIMITED",
    readinessState: "CONNECTED_NOT_READY",
    connectionLabel: "Connected",
    readinessLabel: "Not ready for design",
    detail,
  };
}

export function formatCanvaDiagnosticDetails(status: CanvaStatusDiagnostic | null): string[] {
  if (!status) return [];
  const details: string[] = [];
  if (typeof status.credentialsConfigured === "boolean") {
    details.push(`Server credentials: ${status.credentialsConfigured ? "configured" : "missing"}`);
  }
  if (typeof status.canvaConnected === "boolean") {
    details.push(`Canva API connection: ${status.canvaConnected ? "connected" : "not connected"}`);
  }
  if (typeof status.brandTemplateConfigured === "boolean") {
    details.push(`Brand Template configured: ${status.brandTemplateConfigured ? "yes" : "no"}`);
  }
  if (typeof status.brandTemplateCount === "number") {
    details.push(`Configured Brand Templates: ${status.brandTemplateCount}`);
  }
  if (Array.isArray(status.missingScopes)) {
    const safeScopes = status.missingScopes.filter((scope) => /^[a-z:_]+$/.test(scope));
    details.push(safeScopes.length
      ? `Missing Canva permissions: ${safeScopes.join(", ")}`
      : "Required Canva permissions: present");
  }
  if (typeof status.templateImageFieldCount === "number") {
    details.push(`Brand Template image autofill fields: ${status.templateImageFieldCount}`);
  }
  if (typeof status.templateTextFieldCount === "number") {
    details.push(`Brand Template text autofill fields: ${status.templateTextFieldCount}`);
  }
  if (typeof status.templateImageAutofillReady === "boolean") {
    details.push(`Brand Template image autofill: ${status.templateImageAutofillReady ? "ready" : "not ready"}`);
  }
  if (status.nextAction) details.push(`Server next action: ${status.nextAction}`);
  return details;
}

export function resolveDesignProvider(
  requested: DesignProvider,
  isVideo: boolean,
  canvaReady: boolean,
  videoReady: boolean,
): Exclude<DesignProvider, "auto"> {
  if (requested !== "auto") return requested;
  if (isVideo) return videoReady ? "runway" : "capcut";
  return canvaReady ? "canva" : "manual";
}
