import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type AiProviderKeys = {
  gemini: string;
  openai: string;
};

function safeKey(value: unknown): string {
  if (typeof value !== "string") return "";
  const key = value.trim();
  return key.length >= 12 && key.length <= 512 && !/[\r\n\0]/.test(key) ? key : "";
}

/**
 * Resolve provider keys without ever returning them to the browser.
 * Existing Edge Function secrets remain supported; keys configured through the authorized Connections Center in the
 * protected staff_integration_secrets row take precedence.
 */
export async function loadAiProviderKeys(
  supabase: SupabaseClient,
  envGemini = "",
  envOpenAI = "",
): Promise<AiProviderKeys> {
  let storedGemini = "";
  let storedOpenAI = "";

  try {
    const { data: integration, error: integrationError } = await supabase
      .from("staff_integrations")
      .select("id,status")
      .eq("provider", "ai_provider")
      .maybeSingle();

    if (!integrationError && integration?.id && integration.status !== "disabled" && integration.status !== "not_connected") {
      const { data: secret, error: secretError } = await supabase
        .from("staff_integration_secrets")
        .select("secret_value")
        .eq("integration_id", integration.id)
        .maybeSingle();

      if (!secretError && typeof secret?.secret_value === "string") {
        const parsed = JSON.parse(secret.secret_value) as Record<string, unknown>;
        storedGemini = safeKey(parsed.gemini);
        storedOpenAI = safeKey(parsed.openai);
      }
    }
  } catch {
    // A missing/invalid stored credential must never break existing env-key operation.
  }

  return {
    gemini: storedGemini || safeKey(envGemini),
    openai: storedOpenAI || safeKey(envOpenAI),
  };
}
