-- Improve AI sales concierge: progressive booking, scoped pricing, services blurb,
-- mid-funnel context retention, and deliverable handoff drafts (conversation locks via mode).
-- Mirror of src/ai-sales-concierge/logic.mjs — do not invent prices/services/slots.

CREATE OR REPLACE FUNCTION public.process_ai_sales_concierge_turn(
  p_conversation_id uuid,
  p_message_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_conversation public.conversations%rowtype;
  v_lead public.leads%rowtype;
  v_message public.messages%rowtype;
  v_language text;
  v_body text;
  v_state text;
  v_prior_state text;
  v_service text;
  v_stage text;
  v_score integer;
  v_fear boolean;
  v_draft text;
  v_human_handoff boolean := false;
  v_lock_human boolean := false;
  v_processed boolean := false;
  v_skipped boolean := false;
  v_skip_reason text;
  v_draft_message_id uuid;
  v_prior_outbound integer := 0;
  v_is_first_touch boolean := false;
  v_count text;
  v_pricing text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  select * into v_conversation
  from public.conversations
  where id = p_conversation_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'CONVERSATION_NOT_FOUND');
  end if;

  select * into v_lead
  from public.leads
  where id = v_conversation.lead_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'LEAD_NOT_FOUND');
  end if;

  if p_message_id is not null then
    select * into v_message
    from public.messages
    where id = p_message_id
      and conversation_id = p_conversation_id
      and direction = 'inbound'
      and author_type = 'customer';
  else
    select * into v_message
    from public.messages
    where conversation_id = p_conversation_id
      and direction = 'inbound'
      and author_type = 'customer'
    order by created_at desc, id desc
    limit 1;
  end if;

  if not found then
    return jsonb_build_object('success', false, 'code', 'INBOUND_MESSAGE_NOT_FOUND');
  end if;

  v_body := btrim(coalesce(v_message.body, ''));
  if v_body = '' then
    return jsonb_build_object('success', false, 'code', 'EMPTY_MESSAGE_BODY');
  end if;

  v_language := case
    when v_body ~ '[ء-ي]' then 'ar'
    when v_body ~ '[A-Za-z]' then 'en'
    when coalesce(v_lead.language, '') in ('ar', 'en') then v_lead.language
    else 'en'
  end;
  v_service := nullif(btrim(coalesce(v_lead.service, '')), '');
  v_stage := v_lead.stage::text;
  v_score := coalesce(v_lead.score, 0);
  v_fear := v_lead.fear_of_water;
  v_prior_state := case
    when coalesce(v_lead.intent, '') like 'concierge:%' then substring(v_lead.intent from 11)
    else 'greeting'
  end;
  v_state := v_prior_state;

  select count(*)::integer into v_prior_outbound
  from public.messages
  where conversation_id = v_conversation.id
    and direction = 'outbound';

  v_is_first_touch := (v_prior_outbound = 0 and v_prior_state in ('greeting'));

  if v_conversation.mode::text <> 'ai_active' then
    return jsonb_build_object(
      'success', true,
      'code', 'SKIPPED',
      'processed', false,
      'skipped', true,
      'skipReason', 'CONVERSATION_NOT_AI_ACTIVE',
      'conversationId', v_conversation.id,
      'leadId', v_lead.id,
      'messageId', v_message.id,
      'channel', v_conversation.channel::text,
      'language', v_language,
      'outboundEnabled', false
    );
  end if;

  -- Explicit human / medical / missing location → lock + draft (channel must still deliver).
  if v_body ~* '(human|person|coach|ayman|speak to someone|talk to someone|موظف|بشري|كوتش|أيمن|مدرب|تحدث مع)' then
    v_lock_human := true;
    v_state := 'human_handoff';
    v_draft := case when v_language = 'ar'
      then 'تمام — سأوصلك بالكوتش أيمن للمتابعة الشخصية. سيرد عليك قريبًا.'
      else 'I''ll connect you with Coach Ayman for personal follow-up. He will reply shortly.'
    end;
    v_stage := case when v_stage = 'new' then 'contacted' else v_stage end;
    v_score := v_score + 10;
    v_processed := true;

  elsif v_body ~* '(sick|ill|medical|doctor|health|injury|pain|hospital|مريض|مرض|دكتور|صحة|ألم|جرح|مستشفى|تعبان)' then
    v_lock_human := true;
    v_state := 'human_handoff';
    v_draft := case when v_language = 'ar'
      then 'لأي أمر صحي أو طبي، سيتابع معك الكوتش أيمن شخصيًا. لن أقدّم نصيحة طبية.'
      else 'For health or medical concerns, Coach Ayman will follow up personally. I won''t give medical advice.'
    end;
    v_stage := case when v_stage = 'new' then 'contacted' else v_stage end;
    v_score := v_score + 10;
    v_processed := true;

  elsif v_body ~* '(where|location|address|map|place|are you located|فين|وين|موقع|عنوان|مكان|الموقع)' then
    v_lock_human := true;
    v_state := 'human_handoff';
    v_draft := case when v_language = 'ar'
      then 'ما عندي الموقع الدقيق محفوظ هنا. سأوصلك بالكوتش أيمن لتفاصيل موقع التدريب الدقيقة.'
      else 'I don''t have the exact training location saved here. I''ll connect you with Coach Ayman for the precise details.'
    end;
    v_stage := case when v_stage = 'new' then 'contacted' else v_stage end;
    v_score := v_score + 10;
    v_processed := true;

  elsif v_prior_state = 'booking_ask_count' then
    v_count := case
      when v_body ~* '\m([1-5])\M' then (regexp_match(v_body, '([1-5])'))[1]
      when v_body ~* '(one|واحد|واحدة)' then '1'
      when v_body ~* '(two|اتنين|اثنين|ثنين)' then '2'
      when v_body ~* '(three|ثلاثة|ثلاث)' then '3'
      when v_body ~* '(four|أربعة|اربعة)' then '4'
      when v_body ~* '(five|خمسة)' then '5'
      else null
    end;
    if v_count is not null then
      if v_fear is null then
        v_state := 'awaiting_fear_of_water';
      else
        v_state := 'booking_ask_timing';
      end if;
      v_score := v_score + 10;
      v_stage := 'booking_intent';
    elsif v_body ~* '(price|cost|how much|fee|aed|dirham|سعر|اسعار|الأسعار|الاسعار|تكلفة|درهم)'
          or v_body ~* 'كم[[:space:]]*ال' then
      v_state := 'presented_pricing';
    elsif v_body ~* '(what do you offer|services|packages|خدمات|وش عندكم|شو عندكم|ماذا تقدم|عروضكم|باقات)' then
      v_state := 'awaiting_offer_type';
    else
      v_state := 'booking_ask_count';
    end if;
    v_processed := true;

  elsif v_prior_state = 'booking_ask_timing' then
    if length(v_body) > 0 then
      v_state := 'booking_handoff';
      v_lock_human := true;
      v_score := v_score + 15;
      v_stage := 'booking_intent';
    else
      v_state := 'booking_ask_timing';
    end if;
    v_processed := true;

  elsif v_body ~* '(price|cost|how much|fee|aed|dirham|سعر|اسعار|الأسعار|الاسعار|تكلفة|درهم)'
        or v_body ~* 'كم[[:space:]]*ال' then
    v_state := 'presented_pricing';
    if v_body ~* '(private|individual|one[\s-]?on[\s-]?one|خاص|فردي|حصة خاصة|بريفت|برايفت)' then
      v_service := 'private';
    elsif v_body ~* '(group|family|up to 5|مجموعة|عائلة|جماعي)' then
      v_service := 'group';
    elsif v_body ~* '(sibling|brother|sister|brothers|sisters|إخوة|أخوات|أشقاء|أخ|أخت)' then
      v_service := 'siblings';
    end if;
    if v_stage = 'new' then v_stage := 'contacted'; end if;
    v_processed := true;

  elsif v_body ~* '(what do you offer|services|packages|خدمات|وش عندكم|شو عندكم|ماذا تقدم|عروضكم|باقات)' then
    v_state := 'awaiting_offer_type';
    if v_stage = 'new' then v_stage := 'contacted'; end if;
    v_processed := true;

  elsif v_body ~* '(book|booking|reserve|appointment|subscribe|حجز|موعد|اشتراك|أحجز|احجز)'
        or (
          (v_body ~* '^(yes|yep|yeah|sure|ok|okay)($|[^[:alnum:]])'
            or v_body ~* '^(نعم|أيوه|ايوه|تمام|موافق|يب|أجل)($|[[:space:]])')
          and v_prior_state in ('presented_pricing', 'booking_guidance', 'booking_ask_count')
        ) then
    if v_fear is null and coalesce(v_service, '') in ('private', 'group') then
      v_state := 'awaiting_fear_of_water';
    else
      v_state := 'booking_ask_count';
    end if;
    v_stage := 'booking_intent';
    v_score := v_score + 20;
    v_processed := true;

  elsif v_body ~* '(private|individual|one[\s-]?on[\s-]?one|خاص|فردي|حصة خاصة|بريفت|برايفت)' then
    v_service := 'private';
    if v_fear is null then
      v_state := 'awaiting_fear_of_water';
    else
      v_state := 'presented_pricing';
    end if;
    if v_stage in ('new', 'contacted') then v_stage := 'qualified'; end if;
    v_score := v_score + 10;
    v_processed := true;

  elsif v_body ~* '(sibling|brother|sister|brothers|sisters|إخوة|أخوات|أشقاء|أخ|أخت)' then
    v_service := 'siblings';
    v_state := 'presented_pricing';
    if v_stage in ('new', 'contacted') then v_stage := 'qualified'; end if;
    v_score := v_score + 10;
    v_processed := true;

  elsif v_body ~* '(group|family|up to 5|مجموعة|عائلة|جماعي)' then
    v_service := 'group';
    if v_fear is null then
      v_state := 'awaiting_fear_of_water';
    else
      v_state := 'presented_pricing';
    end if;
    if v_stage in ('new', 'contacted') then v_stage := 'qualified'; end if;
    v_score := v_score + 10;
    v_processed := true;

  elsif v_prior_state = 'awaiting_fear_of_water' then
    if v_body ~* '(fear|afraid|scared|خوف|خايف|خائف)' then
      v_fear := true;
    elsif v_body ~* '(comfortable|fine|no fear|not afraid|مرتاح|ما في خوف|لا خوف)'
          or v_body ~* '^(yes|yep|yeah|sure|ok|okay)($|[^[:alnum:]])'
          or v_body ~* '^(نعم|أيوه|ايوه|تمام|موافق)($|[[:space:]])' then
      v_fear := false;
    end if;
    if v_stage = 'booking_intent' then
      v_state := 'booking_ask_timing';
      v_stage := 'booking_intent';
    else
      v_state := 'presented_pricing';
      if v_stage in ('new', 'contacted') then v_stage := 'qualified'; end if;
    end if;
    v_score := v_score + 10;
    v_processed := true;

  elsif v_body ~* '^(hi|hello|hey|good morning|good evening|good night)($|[^[:alnum:]])'
        or v_body ~* '^(السلام عليكم|عليكم السلام|سلام|مرحبا|مرحبًا|صباح الخير|مساء الخير|أهلا|اهلا|أهلان|اختبار النظام)($|[[:space:]])'
        or v_body ~* '(learn|swim|lesson|training|class|أتعلم|اتعلم|تعلم|سباح|أعوم|اعوم|حصة|دورة|مش بعرف اعوم|ما بعرف اعوم|ما اعرف اعوم)'
        or v_prior_state = 'greeting' then
    if v_prior_state in ('presented_pricing', 'booking_ask_count', 'booking_ask_timing') then
      v_state := v_prior_state;
    elsif v_prior_state = 'awaiting_fear_of_water' then
      v_state := 'awaiting_fear_of_water';
    elsif v_prior_state = 'awaiting_offer_type' and not v_is_first_touch then
      v_state := 'awaiting_offer_type';
    else
      v_state := 'awaiting_offer_type';
      if v_stage = 'new' then v_stage := 'contacted'; end if;
    end if;
    v_processed := true;

  elsif v_prior_state = 'awaiting_offer_type' then
    v_state := 'awaiting_offer_type';
    v_processed := true;

  elsif v_prior_state = 'booking_guidance' then
    v_state := 'booking_ask_count';
    v_stage := 'booking_intent';
    v_processed := true;

  else
    v_lock_human := true;
    v_state := 'human_handoff';
    v_draft := case when v_language = 'ar'
      then 'ما أحب أخمّن في هذا. سأوصلك بالكوتش أيمن ليجيبك بدقة.'
      else 'I don''t want to guess on that. I''ll connect you with Coach Ayman so he can answer accurately.'
    end;
    v_stage := case when v_stage = 'new' then 'contacted' else v_stage end;
    v_score := v_score + 10;
    v_processed := true;
  end if;

  if v_processed and v_draft is null then
    if v_state = 'awaiting_offer_type' then
      if v_body ~* '(what do you offer|services|packages|خدمات|وش عندكم|شو عندكم|ماذا تقدم|عروضكم|باقات)' then
        v_draft := case when v_language = 'ar'
          then 'Relax Fix UAE يقدّم تدريب سباحة وبناء ثقة داخل الماء مع الكوتش أيمن: حصص خاصة، حصص جماعية (حتى 5 أشخاص)، وخصم إخوة عند الاستحقاق. أيّها أنسب لك: خاصة أم مجموعة (حتى 5)؟'
          else 'Relax Fix UAE offers swimming and water-confidence coaching with Coach Ayman: private lessons, group lessons (up to 5 people), and a siblings discount when eligible. Which suits you better: private or group (up to 5)?'
        end;
      elsif (not v_is_first_touch) and v_prior_state = 'awaiting_offer_type' then
        v_draft := case when v_language = 'ar'
          then 'عشان أوجّهك صح — حصة خاصة ولا مجموعة (حتى 5 أشخاص)؟'
          else 'Just to guide you correctly — private lesson or group (up to 5 people)?'
        end;
      else
        v_draft := case when v_language = 'ar'
          then 'أهلًا بك في Relax Fix UAE. هل تفضّل حصة خاصة أم مجموعة (حتى 5 أشخاص)؟'
          else 'Welcome to Relax Fix UAE. Would you like a private lesson or a group lesson (up to 5 people)?'
        end;
      end if;
    elsif v_state = 'awaiting_fear_of_water' then
      v_draft := case when v_language = 'ar'
        then 'سؤال سريع فقط: هل السبّاح مرتاح في الماء، أم يوجد خوف من الماء؟'
        else 'Quick question only: is the swimmer comfortable in water, or is there fear of water?'
      end;
    elsif v_state = 'presented_pricing' then
      if v_service = 'private' then
        v_pricing := case when v_language = 'ar'
          then 'حصة خاصة: 150 درهم بدل 200 درهم — عرض لفترة محدودة.'
          else 'Private lesson: 150 AED instead of 200 AED — limited-time offer.'
        end;
      elsif v_service = 'group' then
        v_pricing := case when v_language = 'ar'
          then 'حصة جماعية: حتى 5 أشخاص — 450 درهم.'
          else 'Group lesson: up to 5 people — 450 AED.'
        end;
      elsif v_service = 'siblings' then
        v_pricing := case when v_language = 'ar'
          then 'خصم الإخوة: 50 درهم لكل أخ/أخت. مثال: مجموعة إخوة مؤهلة = 400 درهم بدل 450 درهم.'
          else 'Siblings discount: 50 AED off per sibling. Example: eligible sibling group = 400 AED instead of 450 AED.'
        end;
      else
        v_pricing := case when v_language = 'ar'
          then E'حصة خاصة: 150 درهم بدل 200 درهم — عرض لفترة محدودة.\nحصة جماعية: حتى 5 أشخاص — 450 درهم.\nخصم الإخوة: 50 درهم لكل أخ/أخت. مثال: مجموعة إخوة مؤهلة = 400 درهم بدل 450 درهم.'
          else E'Private lesson: 150 AED instead of 200 AED — limited-time offer.\nGroup lesson: up to 5 people — 450 AED.\nSiblings discount: 50 AED off per sibling. Example: eligible sibling group = 400 AED instead of 450 AED.'
        end;
      end if;
      v_draft := v_pricing || E'\n\n' || case when v_language = 'ar'
        then 'هل تود المتابعة للحجز؟'
        else 'Would you like to proceed with booking?'
      end;
    elsif v_state = 'booking_ask_count' then
      v_draft := case when v_language = 'ar'
        then 'ممتاز. كم شخص سيحضر الحصة؟ (من 1 إلى 5)'
        else 'Great. How many people will join the lesson? (1–5)'
      end;
    elsif v_state = 'booking_ask_timing' then
      v_draft := case when v_language = 'ar'
        then 'تمام. أي وقت يناسبك أكثر — صباح، مساء، ولا نهاية الأسبوع؟ (لن أخترع مواعيد محددة؛ الكوتش أيمن يؤكد التوفر.)'
        else 'Got it. What time of day suits you better — morning, evening, or weekend? (I won''t invent exact slots; Coach Ayman confirms availability.)'
      end;
    elsif v_state in ('booking_handoff', 'booking_guidance') then
      v_lock_human := true;
      v_state := 'booking_handoff';
      v_draft := case when v_language = 'ar'
        then 'ممتاز — سأحوّل طلبك للكوتش أيمن لتأكيد تفاصيل الحجز معك قريبًا.'
        else 'Perfect — I''ll pass this to Coach Ayman to confirm booking details with you shortly.'
      end;
    end if;
  end if;

  -- humanHandoff in response stays false so Messenger/WA Prepare nodes still deliver the draft.
  -- Conversation is locked via mode=human_required when v_lock_human.
  v_human_handoff := false;

  update public.leads
  set
    language = v_language,
    intent = 'concierge:' || v_state,
    service = coalesce(v_service, service),
    stage = v_stage::public.lead_stage,
    score = v_score,
    fear_of_water = coalesce(v_fear, fear_of_water),
    human_required = case when v_lock_human then true else human_required end,
    updated_at = now()
  where id = v_lead.id;

  if v_lock_human then
    update public.conversations
    set mode = 'human_required', updated_at = now()
    where id = v_conversation.id;
  end if;

  if v_draft is not null then
    insert into public.messages (
      conversation_id,
      direction,
      author_type,
      body,
      safety_classification
    ) values (
      v_conversation.id,
      'outbound',
      'ai',
      v_draft,
      'approved_offer_only'
    )
    returning id into v_draft_message_id;
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    detail
  ) values (
    null,
    'system',
    'ai_sales_concierge_turn',
    'conversation',
    v_conversation.id,
    jsonb_build_object(
      'leadId', v_lead.id,
      'messageId', v_message.id,
      'draftMessageId', v_draft_message_id,
      'channel', v_conversation.channel::text,
      'language', v_language,
      'state', v_state,
      'priorState', v_prior_state,
      'humanHandoff', v_human_handoff,
      'conversationLocked', v_lock_human,
      'outboundEnabled', false
    )
  );

  return jsonb_build_object(
    'success', true,
    'code', case when v_skipped then 'SKIPPED' else 'DRAFT_READY' end,
    'processed', v_processed,
    'skipped', v_skipped,
    'skipReason', v_skip_reason,
    'conversationId', v_conversation.id,
    'leadId', v_lead.id,
    'messageId', v_message.id,
    'draftMessageId', v_draft_message_id,
    'channel', v_conversation.channel::text,
    'language', v_language,
    'intent', 'concierge:' || v_state,
    'stage', v_stage,
    'score', v_score,
    'humanHandoff', v_human_handoff,
    'conversationLocked', v_lock_human,
    'draftReply', v_draft,
    'outboundEnabled', false
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.process_ai_sales_concierge_turn(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn(uuid, uuid) TO service_role;
