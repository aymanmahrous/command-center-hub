-- Store only the selected server-side AI provider in the existing integration row.
-- Provider credentials remain in Edge Function secrets or the existing secret vault table.

create or replace function public.set_staff_ai_provider(p_provider text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  v_id uuid;
  v_metadata jsonb;
begin
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then
    return jsonb_build_object('success', false, 'code', 'STAFF_ACCESS_DENIED');
  end if;
  if p_provider not in ('gemini', 'openai') then
    return jsonb_build_object('success', false, 'code', 'UNSUPPORTED_AI_PROVIDER');
  end if;

  insert into public.staff_integrations (provider, connection_method, display_name)
  values ('ai_provider', 'api_key', 'AI Provider')
  on conflict (provider) do nothing;

  select id, coalesce(metadata, '{}'::jsonb)
    into v_id, v_metadata
    from public.staff_integrations
   where provider = 'ai_provider';

  update public.staff_integrations
     set metadata = v_metadata || jsonb_build_object('selectedProvider', p_provider, 'selectedAt', now()),
         updated_at = now()
   where id = v_id;

  insert into public.audit_logs(actor_id, actor_type, action, entity_type, entity_id, detail)
  values (auth.uid(), 'user', 'ai_provider_selected', 'staff_integration', v_id,
          jsonb_build_object('provider', p_provider));

  return jsonb_build_object('success', true, 'provider', p_provider);
end;
$function$;

grant execute on function public.set_staff_ai_provider(text) to authenticated, service_role;
