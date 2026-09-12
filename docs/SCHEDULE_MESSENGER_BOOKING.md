# Messenger lesson booking write

Flow: slot select → collect name/phone/(party) → confirm → `rf_check` recheck → `rf_commit_messenger_lesson_booking` → occupancy capacity update → `booking_requests` + `rf_lesson_bookings` → n8n Google Calendar create → `rf_finalize_lesson_booking_gcal` → confirmation reply.

Safety: no write on first message; private cap 1; group cap 4; idempotency on inbound message id; Meta duplicate mid ignored; human handoff on incomplete/uncertain.
