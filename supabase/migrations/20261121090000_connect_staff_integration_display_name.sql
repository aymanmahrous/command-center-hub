create or replace function public.connect_staff_integration(
  p_provider text, p_connection_method text, p_secret text default null, p_secret_hint text default null, p_account_label text default null, p_metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_id uuid; v_now timestamptz := now(); v_hint text;
begin
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then return jsonb_build_object('success', false, 'code', 'STAFF_ACCESS_DENIED'); end if;
  if p_provider not in ('meta_whatsapp','instagram','facebook','telegram','google_calendar','canva','ai_provider') then return jsonb_build_object('success', false, 'code', 'UNSUPPORTED_PROVIDER'); end if;
  if p_connection_method not in ('oauth','api_key','manual') then return jsonb_build_object('success', false, 'code', 'UNSUPPORTED_METHOD'); end if;
  if p_connection_method = 'api_key' and char_length(trim(coalesce(p_secret,''))) < 12 then return jsonb_build_object('success', false, 'code', 'SECRET_TOO_SHORT'); end if;
  if p_connection_method <> 'api_key' and nullif(trim(coalesce(p_secret,'')), '') is null then return jsonb_build_object('success', false, 'code', 'CREDENTIAL_REQUIRED'); end if;
  v_hint := coalesce(nullif(left(trim(p_secret_hint), 32), ''), case when p_secret is not null then '••••' || right(trim(p_secret), 4) else null end);
  insert into public.staff_integrations(provider, display_name, connection_method, status, account_label, secret_hint, metadata, connected_by, connected_at, updated_at)
  values (p_provider, case p_provider
    when 'meta_whatsapp' then 'WhatsApp / Meta'
    when 'instagram' then 'Instagram'
    when 'facebook' then 'Facebook'
    when 'telegram' then 'Telegram'
    when 'google_calendar' then 'Google Calendar'
    when 'canva' then 'Canva'
    when 'ai_provider' then 'AI Provider'
  end, p_connection_method, 'needs_test', nullif(left(trim(p_account_label), 120), ''), v_hint, coalesce(p_metadata, '{}'::jsonb), auth.uid(), v_now, v_now)
  on conflict (provider) do update set connection_method = excluded.connection_method, status = 'needs_test', account_label = excluded.account_label, secret_hint = excluded.secret_hint, metadata = excluded.metadata, connected_by = auth.uid(), connected_at = v_now, last_error_code = null, updated_at = v_now
  returning id into v_id;
  if nullif(trim(coalesce(p_secret,'')), '') is not null then
    insert into public.staff_integration_secrets(integration_id, secret_value, updated_at, updated_by) values (v_id, trim(p_secret), v_now, auth.uid())
    on conflict (integration_id) do update set secret_value = excluded.secret_value, updated_at = v_now, updated_by = auth.uid();
  end if;
  insert into public.audit_logs(actor_id, actor_type, action, entity_type, entity_id, detail) values(auth.uid(), 'user', 'integration_connected', 'staff_integration', v_id, jsonb_build_object('provider', p_provider, 'method', p_connection_method, 'accountLabel', nullif(left(trim(p_account_label), 120), '')));
  return jsonb_build_object('success', true, 'code', 'INTEGRATION_SAVED', 'integrationId', v_id, 'status', 'needs_test', 'secretHint', v_hint);
end;
$function$;
