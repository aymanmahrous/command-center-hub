# Schedule architecture (owner-approved)

## Source of truth
- Google Calendar: **Relax Fix UAE Lessons**
- Calendar ID stored in `rf_schedule_config.lessons_calendar` and `LESSONS_CALENDAR` in code
- Occupied times only — empty calendar means no bookings yet (not invented slots)

## Rules
- Timezone: Asia/Dubai
- Duration: 45 minutes
- Private capacity: 1 · Group capacity: 4
- Coach: Coach Ayman
- Class windows (all 4 locations): Sat–Sun 10:00–22:00 · Mon–Fri 16:00–21:00
- Windows ≠ availability; status uses occupancy:
  - `OUTSIDE_WINDOW` · `AVAILABLE` · `BOOKED` · `PARTIALLY_AVAILABLE` (group places left)

## Components
- `src/ai-sales-concierge/availability.mjs` — pure check + GCal event builder
- `rf_check_lesson_availability` — read RPC (service_role)
- `rf_prepare_lesson_booking_write` — write prepare with `p_confirm=true` required (no fake bookings)
- `rf_lesson_occupancy` — mirror pending/synced occupancy

## Not done in this step
- Wire into Messenger AI replies
- Create real customer bookings
- Modify Meta/webhook/ingress
