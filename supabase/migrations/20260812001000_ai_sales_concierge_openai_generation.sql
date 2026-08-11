-- Phase 6D: AI-generated WhatsApp replies with cost caps + usage logging.
-- Keeps deterministic state-machine guardrails in process_ai_sales_concierge_turn.
-- Natural reply text is generated in n8n via existing free OpenAI credits (gpt-5-nano).
-- DO NOT invent prices outside approved facts. Outbound remains WhatsApp-only.

CREATE TABLE IF NOT EXISTS public.ai_concierge_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  provider text NOT NULL DEFAULT 'openai',
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  total_tokens integer NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  capped boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_concierge_usage_logs_created_at_idx
  ON public.ai_concierge_usage_logs (created_at desc);

CREATE INDEX IF NOT EXISTS ai_concierge_usage_logs_conversation_hour_idx
  ON public.ai_concierge_usage_logs (conversation_id, created_at desc);

REVOKE ALL ON TABLE public.ai_concierge_usage_logs FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE public.ai_concierge_usage_logs TO service_role;

-- Claim at most one AI generation slot per inbound message; enforce hourly/daily caps.
CREATE OR REPLACE FUNCTION public.claim_ai_concierge_generation(
  p_conversation_id uuid,
  p_message_id uuid DEFAULT NULL,
  p_hourly_cap integer DEFAULT 12,
  p_daily_cap integer DEFAULT 250
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_hourly integer := 0;
  v_daily integer := 0;
  v_inbound_claims integer := 0;
  v_recent jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if p_message_id is not null then
    select count(*)::integer into v_inbound_claims
    from public.ai_concierge_usage_logs
    where message_id = p_message_id
      and coalesce(capped, false) = false
      and source = 'ai';
    if v_inbound_claims >= 1 then
      return jsonb_build_object(
        'success', true,
        'allowed', false,
        'reason', 'INBOUND_CAP',
        'hourlyCount', 0,
        'dailyCount', 0,
        'recentMessages', '[]'::jsonb
      );
    end if;
  end if;

  select count(*)::integer into v_hourly
  from public.ai_concierge_usage_logs
  where conversation_id = p_conversation_id
    and created_at >= now() - interval '1 hour'
    and coalesce(capped, false) = false
    and source = 'ai';

  select count(*)::integer into v_daily
  from public.ai_concierge_usage_logs
  where created_at >= date_trunc('day', now() at time zone 'utc')
    and coalesce(capped, false) = false
    and source = 'ai';

  if v_hourly >= greatest(p_hourly_cap, 1) then
    return jsonb_build_object(
      'success', true,
      'allowed', false,
      'reason', 'CONVERSATION_HOURLY_CAP',
      'hourlyCount', v_hourly,
      'dailyCount', v_daily,
      'recentMessages', '[]'::jsonb
    );
  end if;

  if v_daily >= greatest(p_daily_cap, 1) then
    return jsonb_build_object(
      'success', true,
      'allowed', false,
      'reason', 'DAILY_GLOBAL_CAP',
      'hourlyCount', v_hourly,
      'dailyCount', v_daily,
      'recentMessages', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'role', case when m.direction = 'inbound' then 'customer' else 'assistant' end,
        'body', left(coalesce(m.body, ''), 500)
      )
      order by m.created_at asc
    ),
    '[]'::jsonb
  )
  into v_recent
  from (
    select direction, body, created_at
    from public.messages
    where conversation_id = p_conversation_id
    order by created_at desc
    limit 8
  ) m;

  return jsonb_build_object(
    'success', true,
    'allowed', true,
    'reason', null,
    'hourlyCount', v_hourly,
    'dailyCount', v_daily,
    'recentMessages', v_recent,
    'model', 'gpt-5-nano',
    'maxOutputTokens', 220
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_ai_concierge_usage(
  p_conversation_id uuid,
  p_message_id uuid DEFAULT NULL,
  p_channel text DEFAULT 'whatsapp',
  p_provider text DEFAULT 'openai',
  p_model text DEFAULT 'gpt-5-nano',
  p_prompt_tokens integer DEFAULT 0,
  p_completion_tokens integer DEFAULT 0,
  p_total_tokens integer DEFAULT 0,
  p_capped boolean DEFAULT false,
  p_source text DEFAULT 'ai'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  insert into public.ai_concierge_usage_logs (
    conversation_id,
    message_id,
    channel,
    provider,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    capped,
    source
  ) values (
    p_conversation_id,
    p_message_id,
    coalesce(nullif(btrim(p_channel), ''), 'whatsapp'),
    coalesce(nullif(btrim(p_provider), ''), 'openai'),
    coalesce(nullif(btrim(p_model), ''), 'gpt-5-nano'),
    greatest(coalesce(p_prompt_tokens, 0), 0),
    greatest(coalesce(p_completion_tokens, 0), 0),
    greatest(coalesce(p_total_tokens, 0), 0),
    coalesce(p_capped, false),
    coalesce(nullif(btrim(p_source), ''), 'ai')
  )
  returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$function$;

REVOKE ALL ON FUNCTION public.claim_ai_concierge_generation(uuid, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_concierge_generation(uuid, uuid, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.log_ai_concierge_usage(uuid, uuid, text, text, text, integer, integer, integer, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_ai_concierge_usage(uuid, uuid, text, text, text, integer, integer, integer, boolean, text) TO service_role;
