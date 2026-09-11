-- Phase 6D documentation only (NOT applied to Production).
-- Provider-agnostic STT foundation lives in:
--   src/ai-sales-concierge/stt.mjs
--   src/ai-sales-concierge/voice.mjs
--
-- No schema change is required for the foundation.
-- Existing messages / conversations / leads columns are reused.
--
-- Owner must approve ONE STT credential before Production wiring:
--   OPENAI_API_KEY  (openai_whisper)
--   or GOOGLE_SPEECH_CREDENTIALS_JSON (google_speech_to_text)
--
-- After approval, n8n may call the approved provider, then feed text into
-- process_ai_sales_concierge_turn(conversation_id, message_id) as draft-only.
-- outboundEnabled remains false until a later explicit owner phase.

SELECT 'phase6d_stt_foundation_docs_only' AS phase6d_note;
