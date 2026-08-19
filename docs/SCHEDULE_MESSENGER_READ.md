# Messenger schedule read wiring

Live `rf_schedule_turn` now calls `rf_check_lesson_availability` (READ ONLY).

Flow: Messenger → process_ai_sales_concierge_turn → rf_schedule_turn → rf_check_lesson_availability
Calendar source: Relax Fix UAE Lessons (occupancy mirror; empty = no bookings).

No booking writes. "احجز لي" → schedule_confirm_needed only.
