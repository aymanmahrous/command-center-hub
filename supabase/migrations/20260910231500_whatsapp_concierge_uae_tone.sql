-- UAE/Gulf tone polish for WhatsApp concierge prerouter (short, professional, booking-oriented).

CREATE OR REPLACE FUNCTION public.rf_concierge_v2_prerouter(
  p_language text,
  p_body text,
  p_prior_state text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_body text := btrim(coalesce(p_body, ''));
  v_lang text := case when p_language = 'ar' then 'ar' else 'en' end;
BEGIN
  IF v_body = '' THEN RETURN jsonb_build_object('handled', false); END IF;

  IF v_body ~* '(شكرا.*(وقت ثاني|بعدين)|هكلمك.*(وقت ثاني|بعدين)|اكلمك.*(وقت ثاني|بعدين)|thanks.*(later|another time)|talk.*later|speak.*later|bye|goodbye|مع السلامة|باي)' THEN
    RETURN jsonb_build_object('handled',true,'state','conversation_paused','intent','conversation_close','draft',case when v_lang='ar' then 'العفو. أنا هنا وقت ما تحتاجنا. يومك سعيد.' else 'You''re welcome. I''m here whenever you need us. Have a great day.' end);
  END IF;

  IF v_body ~* '(مش عايز.*حصة|مش محتاج.*حصة|مش عاوز.*حصة|ما ابي.*حصة|لا ابي.*حصة|لاني مشترك|لأنني مشترك|انا مشترك|أنا مشترك|already.*(member|customer|subscribed)|don.?t want.*lesson|not looking.*book)' THEN
    RETURN jsonb_build_object('handled',true,'state','general_help','intent','existing_customer_non_booking','draft',case when v_lang='ar' then 'تمام، فهمت أنك لا تبحث عن حجز حصة. ما المعلومة التي تحتاجها؟' else 'Got it — you''re not asking to book a lesson. What would you like to know?' end);
  END IF;

  IF v_body ~* '(بسأل.*(شيء|شىء|حاجة).*(تاني|تانى|تلني)|بسال.*(شيء|شىء|حاجة).*(تاني|تانى|تلني)|موضوع تاني|موضوع تانى|حاجة تانية|حاجه تانيه|something else|different question|another question|change.*topic)' THEN
    RETURN jsonb_build_object('handled',true,'state','general_help','intent','topic_change','draft',case when v_lang='ar' then 'أكيد، تفضل. ما الذي تحب أن تعرفه؟' else 'Of course. What would you like to know?' end);
  END IF;

  IF v_body ~* '(خبرته|خبرة المدرب|خبرة الكوتش|experience)' THEN
    RETURN jsonb_build_object(
      'handled',true,
      'state','coach_info',
      'intent','coach_experience',
      'draft',case when v_lang='ar'
        then 'كوتش أيمن لديه أكثر من 15 سنة خبرة في تدريب السباحة، مع الأطفال والمبتدئين وبناء الثقة في الماء خطوة بخطوة. التدريب متاح حصة خاصة أو مجموعة حتى 5 أشخاص. تحب أقول لك أي نوع أنسب لك أو لطفلك؟'
        else 'Coach Ayman has more than 15 years of swimming-coaching experience with children, beginners, and water-confidence development. Training is available as private lessons or groups up to 5 people. Would you like help choosing the best option for you or your child?' end
    );
  END IF;

  IF v_body ~* '(اسلوب تدريبه|أسلوب تدريبه|اسلوب التدريب|أسلوب التدريب|training style|coaching style)' THEN
    RETURN jsonb_build_object(
      'handled',true,
      'state','coach_info',
      'intent','coach_style',
      'draft',case when v_lang='ar'
        then 'أسلوب كوتش أيمن هادئ وعملي: يبدأ من مستوى السباح الحقيقي ويبني المهارة والثقة تدريجياً. مع الأطفال والمبتدئين التركيز على الأمان والراحة أولاً. هل التدريب لك أم لطفل؟'
        else 'Coach Ayman''s style is calm and practical: he starts from the swimmer''s real level and builds skill and confidence gradually. With children and beginners, safety and comfort come first. Is the training for you or a child?' end
    );
  END IF;

  IF v_body ~* '(عن مدرب|عن المدر[ب]|معلومات.*مدرب|المدرب|الكوتش|coach|trainer)' AND v_body !~* '(احجز|أحجز|book|reserve|موعد|available|availability|متاح|توفر)' THEN
    RETURN jsonb_build_object('handled',true,'state','coach_info','intent','coach_info','draft',case when v_lang='ar' then 'المدرب هو كوتش أيمن، بخبرة أكثر من 15 سنة في تدريب السباحة. تحب تعرف عن خبرته، أسلوب التدريب، أو أنسب نوع حصة لك أو لطفلك؟' else 'The coach is Coach Ayman, with more than 15 years of swimming-coaching experience. Would you like to know about his experience, coaching style, or the best lesson type for you or your child?' end);
  END IF;

  IF v_body ~* '(مبتفهم|مش فاهم|ما فهمت|فهمك بطي|بتخترع|هو انا لسه قولت|ليه بتكرر|حصل تكرار|why.*repeat|you.*don.?t understand|you.*invent|wrong answer)' THEN
    RETURN jsonb_build_object('handled',true,'state','general_help','intent','repair_conversation','draft',case when v_lang='ar' then 'معك حق، الرد السابق لم يجب سؤالك. اكتب سؤالك مباشرة وسأجيب عليه.' else 'You''re right — the previous reply didn''t answer your question. Please ask directly and I''ll answer that.' end);
  END IF;

  IF v_body ~* '^(الو+|هالو|هلا|اهلا|أهلا|السلام عليكم|عليكم السلام|صباح الخير|مساء الخير|مرحبا|مرحبًا|hi|hello|hey|good morning|good evening)[[:space:]!؟?.]*$' THEN
    RETURN jsonb_build_object('handled',true,'state','greeting','intent','greeting','draft',case when v_lang='ar' then 'أهلًا وسهلًا في Relax Fix UAE. كيف أقدر أساعدك؟ هل تبحث حصة سباحة خاصة أو مجموعة (حتى 5 أشخاص)؟' else 'Hello, welcome to Relax Fix UAE. How can I help you today? Are you looking for a private or group swimming lesson (up to 5 people)?' end);
  END IF;

  RETURN jsonb_build_object('handled', false);
END;
$function$;
