-- Phase 6F: Facebook + Instagram inbound webhook ingress into existing CRM tables.
-- Service-role only. No outbound messaging. Reuses process_ai_sales_concierge_turn downstream.

CREATE OR REPLACE FUNCTION public.process_meta_messaging_webhook_ingress(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_expected_facebook_page_id constant text := '1164107840123575';
  v_expected_instagram_account_id constant text := '17841439747493221';
  v_object text;
  v_channel public.channel_type;
  v_provider text;
  v_entry_id text;
  v_sender_id text;
  v_recipient_id text;
  v_provider_event_id text;
  v_message_body text;
  v_is_echo boolean;
  v_lead_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_existing_webhook uuid;
  v_display_name text;
  v_language text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  v_object := coalesce(p_payload->>'object', '');

  if v_object = 'page' then
    v_channel := 'facebook';
    v_provider := 'facebook';
  elsif v_object = 'instagram' then
    v_channel := 'instagram';
    v_provider := 'instagram';
  else
    return jsonb_build_object('success', false, 'code', 'UNSUPPORTED_OBJECT');
  end if;

  select
    entry.value->>'id',
    msg.value->'sender'->>'id',
    msg.value->'recipient'->>'id',
    msg.value->'message'->>'mid',
    msg.value->'message'->>'text',
    coalesce((msg.value->'message'->>'is_echo')::boolean, false)
  into
    v_entry_id,
    v_sender_id,
    v_recipient_id,
    v_provider_event_id,
    v_message_body,
    v_is_echo
  from jsonb_array_elements(coalesce(p_payload->'entry', '[]'::jsonb)) entry(value)
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(entry.value->'messaging') = 'array'
        then entry.value->'messaging'
      else '[]'::jsonb
    end
  ) msg(value)
  where msg.value ? 'message'
  limit 1;

  if v_provider_event_id is null then
    return jsonb_build_object('success', true, 'code', 'NO_MESSAGE_EVENT', 'processed', false);
  end if;

  if v_is_echo then
    return jsonb_build_object('success', true, 'code', 'ECHO_MESSAGE', 'processed', false);
  end if;

  if v_channel = 'facebook' then
    if v_recipient_id is distinct from v_expected_facebook_page_id
       and v_entry_id is distinct from v_expected_facebook_page_id then
      return jsonb_build_object('success', false, 'code', 'PAGE_ID_MISMATCH');
    end if;

    if v_sender_id = v_expected_facebook_page_id then
      return jsonb_build_object('success', true, 'code', 'OUTBOUND_ECHO', 'processed', false);
    end if;
  else
    if v_recipient_id is distinct from v_expected_instagram_account_id
       and v_entry_id is distinct from v_expected_instagram_account_id then
      return jsonb_build_object('success', false, 'code', 'INSTAGRAM_ACCOUNT_ID_MISMATCH');
    end if;

    if v_sender_id = v_expected_instagram_account_id then
      return jsonb_build_object('success', true, 'code', 'OUTBOUND_ECHO', 'processed', false);
    end if;
  end if;

  v_message_body := coalesce(v_message_body, '');
  if btrim(v_message_body) = '' then
    return jsonb_build_object('success', true, 'code', 'UNSUPPORTED_MESSAGE_TYPE', 'processed', false);
  end if;

  select id
  into v_existing_webhook
  from public.webhook_events
  where provider = v_provider
    and provider_event_id = v_provider_event_id
  limit 1;

  if found then
    return jsonb_build_object(
      'success', true,
      'code', 'DUPLICATE_EVENT',
      'duplicate', true,
      'processed', false,
      'channel', v_channel::text
    );
  end if;

  insert into public.webhook_events (
    provider,
    provider_event_id,
    event_type,
    payload,
    processed_at
  ) values (
    v_provider,
    v_provider_event_id,
    'messages',
    p_payload,
    now()
  );

  v_language := case when v_message_body ~ '[ء-ي]' then 'ar' else 'en' end;
  v_display_name := case
    when v_channel = 'facebook' then 'Facebook ' || v_sender_id
    else 'Instagram ' || v_sender_id
  end;

  select c.id, c.lead_id
  into v_conversation_id, v_lead_id
  from public.conversations c
  where c.channel = v_channel
    and c.external_thread_id = v_sender_id
  limit 1;

  if not found then
    insert into public.leads (
      name,
      full_name,
      language,
      source_channel,
      stage,
      score
    ) values (
      v_display_name,
      v_display_name,
      v_language,
      v_channel,
      'new',
      0
    )
    returning id into v_lead_id;

    insert into public.conversations (
      lead_id,
      channel,
      external_thread_id,
      mode,
      unread_count
    ) values (
      v_lead_id,
      v_channel,
      v_sender_id,
      'ai_active',
      0
    )
    returning id into v_conversation_id;
  else
    update public.leads
    set
      language = v_language,
      updated_at = now()
    where id = v_lead_id;
  end if;

  insert into public.messages (
    conversation_id,
    external_message_id,
    direction,
    author_type,
    body
  ) values (
    v_conversation_id,
    v_provider_event_id,
    'inbound',
    'customer',
    v_message_body
  )
  on conflict (conversation_id, external_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    return jsonb_build_object(
      'success', true,
      'code', 'DUPLICATE_MESSAGE',
      'duplicate', true,
      'processed', false,
      'conversationId', v_conversation_id,
      'leadId', v_lead_id,
      'channel', v_channel::text,
      'language', v_language
    );
  end if;

  update public.conversations
  set
    unread_count = unread_count + 1,
    updated_at = now()
  where id = v_conversation_id;

  return jsonb_build_object(
    'success', true,
    'code', 'MESSAGE_INGESTED',
    'processed', true,
    'duplicate', false,
    'conversationId', v_conversation_id,
    'leadId', v_lead_id,
    'messageId', v_message_id,
    'channel', v_channel::text,
    'language', v_language
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.process_meta_messaging_webhook_ingress(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_meta_messaging_webhook_ingress(jsonb) TO service_role;
