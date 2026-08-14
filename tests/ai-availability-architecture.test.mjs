import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASS_DURATION_MINUTES,
  CLASS_WINDOWS,
  CURRENT_COACH,
  LESSONS_CALENDAR,
  SCHEDULE_LOCATIONS,
  SESSION_CAPACITY,
  buildLessonCalendarEvent,
  checkAvailability,
  dubaiLocalToUtcDate,
  evaluateClassWindow,
  parseCalendarEventToOccupancy,
} from "../src/ai-sales-concierge/availability.mjs";

test("owner-approved constants are loaded", () => {
  assert.equal(SCHEDULE_LOCATIONS.length, 4);
  assert.equal(CLASS_DURATION_MINUTES, 45);
  assert.equal(SESSION_CAPACITY.private, 1);
  assert.equal(SESSION_CAPACITY.group, 4);
  assert.equal(CURRENT_COACH, "Coach Ayman");
  assert.ok(LESSONS_CALENDAR.calendarId.includes("@group.calendar.google.com"));
  assert.equal(CLASS_WINDOWS.saturday.open, "10:00");
  assert.equal(CLASS_WINDOWS.monday.open, "16:00");
  assert.equal(CLASS_WINDOWS.friday.close, "21:00");
});

test("outside window is OUTSIDE_WINDOW", () => {
  // Monday 10:00 Dubai is outside weekday 16:00–21:00
  const start = dubaiLocalToUtcDate("2026-08-17", "10:00"); // Monday
  const result = checkAvailability({
    locationId: "ics-al-falah",
    sessionType: "private",
    start,
    occupancyEvents: [],
  });
  assert.equal(result.status, "OUTSIDE_WINDOW");
  assert.equal(result.canBook, false);
});

test("empty calendar inside window is AVAILABLE (no invented bookings)", () => {
  const start = dubaiLocalToUtcDate("2026-08-15", "11:00"); // Saturday
  const result = checkAvailability({
    locationId: "najda-street",
    sessionType: "private",
    start,
    occupancyEvents: [],
  });
  assert.equal(result.status, "AVAILABLE");
  assert.equal(result.availablePlaces, 1);
  assert.equal(result.canBook, true);
});

test("private conflicts with any overlapping coach occupancy", () => {
  const start = dubaiLocalToUtcDate("2026-08-15", "18:00");
  const end = dubaiLocalToUtcDate("2026-08-15", "18:45");
  const result = checkAvailability({
    locationId: "ics-khalifa",
    sessionType: "private",
    start,
    occupancyEvents: [
      {
        id: "evt1",
        locationId: "ics-al-falah",
        sessionType: "private",
        coach: CURRENT_COACH,
        start,
        end,
        bookedCount: 1,
        capacity: 1,
      },
    ],
  });
  assert.equal(result.status, "BOOKED");
});

test("group partial capacity PARTIALLY_AVAILABLE", () => {
  const start = dubaiLocalToUtcDate("2026-08-16", "17:00"); // Sunday
  const end = dubaiLocalToUtcDate("2026-08-16", "17:45");
  const result = checkAvailability({
    locationId: "ics-mushrif",
    sessionType: "group",
    start,
    occupancyEvents: [
      {
        id: "g1",
        locationId: "ics-mushrif",
        sessionType: "group",
        coach: CURRENT_COACH,
        start,
        end,
        bookedCount: 2,
        capacity: 4,
      },
    ],
  });
  assert.equal(result.status, "PARTIALLY_AVAILABLE");
  assert.equal(result.availablePlaces, 2);
  assert.equal(result.canBook, true);
});

test("group full is BOOKED", () => {
  const start = dubaiLocalToUtcDate("2026-08-16", "17:00");
  const end = dubaiLocalToUtcDate("2026-08-16", "17:45");
  const result = checkAvailability({
    locationId: "ics-mushrif",
    sessionType: "group",
    start,
    occupancyEvents: [
      {
        id: "g1",
        locationId: "ics-mushrif",
        sessionType: "group",
        coach: CURRENT_COACH,
        start,
        end,
        bookedCount: 4,
        capacity: 4,
      },
    ],
  });
  assert.equal(result.status, "BOOKED");
  assert.equal(result.availablePlaces, 0);
});

test("build + parse calendar event round-trip metadata", () => {
  const start = dubaiLocalToUtcDate("2026-08-15", "12:00");
  const body = buildLessonCalendarEvent({
    locationId: "ics-al-falah",
    sessionType: "group",
    start,
    bookedCount: 1,
  });
  assert.equal(body.calendarId, LESSONS_CALENDAR.calendarId);
  assert.match(body.summary, /group \| ICS Al Falah \| Coach Ayman/);
  const occ = parseCalendarEventToOccupancy({
    id: "x",
    summary: body.summary,
    description: body.description,
    location: body.location,
    start: body.start,
    end: body.end,
    extendedProperties: body.extendedProperties,
  });
  assert.equal(occ.locationId, "ics-al-falah");
  assert.equal(occ.sessionType, "group");
  assert.equal(occ.bookedCount, 1);
  assert.equal(occ.capacity, 4);
});

test("lesson ending exactly at window close is allowed", () => {
  // Mon window opens 16:00 close 21:00 → 20:15–21:00 OK
  const start = dubaiLocalToUtcDate("2026-08-17", "20:15");
  const w = evaluateClassWindow(start, 45);
  assert.equal(w.inWindow, true);
});
