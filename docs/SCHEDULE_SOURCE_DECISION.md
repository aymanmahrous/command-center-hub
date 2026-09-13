# Live availability source — decision (2026-08-14)

## Decision
- **STATUS:** `NEEDS_SCHEDULE_INPUT`
- **RECOMMENDED_SOURCE:** Google Calendar (existing valid n8n OAuth)
- Do **not** invent slots. Do **not** auto-book from AI yet.

## Verified facts
| Check | Result |
|---|---|
| Google Calendar OAuth test | Connection Successful |
| Calendars visible | 10 (personal / family / holidays / Doha FB appointments) |
| Calendar named Relax Fix / Swim Fluent | No |
| Upcoming 60d events scanned | 56 |
| Events matching swim/lesson/Relax Fix | 0 |

## Event shape (when owner adds real lessons)
Use a **new dedicated calendar**: `Relax Fix UAE Lessons`

Each event:
- **Title:** `خاصة | ICS الفلاح | الكوتش أيمن` or `private | ICS Al Falah | Coach Ayman`
- **Location:** one of the four pools
- **Start / End:** real timed lesson window
- **Description (optional):** `capacity=1` (private) or `capacity=5` (group); `booked=0` if known

## Owner input needed (minimal)
See PR / agent STATUS block — plain-language list only.
