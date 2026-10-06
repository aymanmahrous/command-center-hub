-- Canva OAuth stores its credential in staff_canva_tokens, not staff_integration_secrets.
-- Keep the generic Connections test truthful for this existing provider-specific store.
create or replace function public.test_staff_integration(p_provider text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  v_id uuid;
begin
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then
    return jsonb_build_object('success', false, 'code', 'STAFF_ACCESS_DENIED');
  end if;

  select id into v_id
  from public.staff_integrations
  where provider = p_provider;

  if not found then
    return jsonb_build_object('success', false, 'code', 'INTEGRATION_NOT_FOUND');
  end if;

  if p_provider = 'canva' then
    if not exists (
      select 1
      from public.staff_canva_tokens
      where staff_id = auth.uid()
        and refresh_token is not null
    ) then
      return jsonb_build_object('success', false, 'code', 'CREDENTIAL_MISSING');
    end if;
  elsif not exists (
    select 1
    from public.staff_integration_secrets
    where integration_id = v_id
  ) then
    return jsonb_build_object('success', false, 'code', 'CREDENTIAL_MISSING');
  end if;

  update public.staff_integrations
  set status = 'connected',
      last_tested_at = now(),
      last_error_code = null,
      updated_at = now()
  where id = v_id;

  insert into public.audit_logs(actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    auth.uid(), 'user', 'integration_tested', 'staff_integration', v_id,
    jsonb_build_object('provider', p_provider, 'result', 'configured')
  );

  return jsonb_build_object(
    'success', true,
    'code', 'CONNECTION_CONFIGURED',
    'provider', p_provider,
    'status', 'connected',
    'testedAt', now()
  );
end;
$function$;

grant execute on function public.test_staff_integration(text) to authenticated;
