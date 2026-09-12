/**
 * Owner-approved schedule architecture for Relax Fix UAE.
 * Google Calendar "Relax Fix UAE Lessons" is the source of truth for occupied times.
 * Class windows define when lessons MAY run — they do NOT invent availability.
 */

export const SCHEDULE_TIMEZONE = "Asia/Dubai";
export const CLASS_DURATION_MINUTES = 45;
export const CURRENT_COACH = "Coach Ayman";

export const SESSION_CAPACITY = {
  private: 1,
  group: 4,
};

/** Owner-approved class windows (local Asia/Dubai). Same for all four locations. */
export const CLASS_WINDOWS = {
  saturday: { open: "10:00", close: "22:00" },
  sunday: { open: "10:00", close: "22:00" },
  monday: { open: "16:00", close: "21:00" },
  tuesday: { open: "16:00", close: "21:00" },
  wednesday: { open: "16:00", close: "21:00" },
  thursday: { open: "16:00", close: "21:00" },
  friday: { open: "16:00", close: "21:00" },
};

export const SCHEDULE_LOCATIONS = [
  {
    id: "najda-street",
    name: "ICS Al Najda",
    nameAr: "ICS النجدة",
    mapUrl: "https://maps.app.goo.gl/XL9weMpSJcpVDNCV6",
  },
  {
    id: "ics-al-falah",
    name: "ICS Al Falah",
    nameAr: "ICS الفلاح",
    mapUrl: "https://maps.app.goo.gl/b5LULVrArcD8BwhF9",
  },
  {
    id: "ics-khalifa",
    name: "ICS Al Khalifa",
    nameAr: "ICS مدينة خليفة",
    mapUrl: "https://maps.app.goo.gl/cbWqzLqDSYXmEFyS9",
  },
  {
    id: "ics-mushrif",
    name: "ICS Al Mushrif",
    nameAr: "ICS المشرف",
    mapUrl: "https://maps.app.goo.gl/Rgu2vKH7JDigAQQx6",
  },
];

export const LESSONS_CALENDAR = {
  summary: "Relax Fix UAE Lessons",
  calendarId:
    "f3174382847e3a2d3a546ecb2c16d605d589bfd4f1e29c39ec950c1c5377dbf8@group.calendar.google.com",
  timeZone: SCHEDULE_TIMEZONE,
  n8nCredentialId: "uVP3oHdTvCq0b0fR",
  role: "source_of_truth_for_occupied_times",
};

/** @typedef {'private'|'group'} SessionType */
/** @typedef {'OUTSIDE_WINDOW'|'AVAILABLE'|'BOOKED'|'PARTIALLY_AVAILABLE'|'MISSING_INPUT'} AvailabilityStatus */

/**
 * @typedef {{
 *   id?: string,
 *   locationId: string,
 *   sessionType: SessionType,
 *   coach?: string,
 *   start: string|Date,
 *   end: string|Date,
 *   bookedCount: number,
 *   capacity: number,
 * }} LessonOccupancy
 */

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseHm(hm) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/** Format a Date as YYYY-MM-DD in Asia/Dubai. */
export function dubaiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHEDULE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Minutes from midnight in Asia/Dubai for an Instant. */
export function dubaiMinutesOfDay(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHEDULE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

export function dubaiWeekdayName(date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TIMEZONE,
    weekday: "long",
  })
    .format(date)
    .toLowerCase();
  return weekday;
}

/**
 * Build a Date for a Dubai local wall time (YYYY-MM-DD + HH:MM).
 * Uses noon-offset trick via temporal-less ISO with fixed +04:00 (Asia/Dubai no DST).
 */
export function dubaiLocalToUtcDate(dateStr, hm) {
  return new Date(`${dateStr}T${hm}:00+04:00`);
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function normalizeSessionType(value) {
  const v = String(value || "").toLowerCase();
  if (v === "private" || v === "خاص" || v === "فردي") return "private";
  if (v === "group" || v === "جماعي" || v === "مجموعة") return "group";
  return null;
}

export function resolveLocationId(value) {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  const exact = SCHEDULE_LOCATIONS.find((l) => l.id === raw);
  if (exact) return exact.id;
  const byName = SCHEDULE_LOCATIONS.find(
    (l) =>
      l.name.toLowerCase() === raw ||
      l.nameAr === value ||
      raw.includes(l.id) ||
      l.name.toLowerCase().includes(raw),
  );
  return byName?.id || null;
}

/**
 * Check if a 45-minute lesson starting at `start` fits inside the approved window.
 */
export function evaluateClassWindow(start, durationMinutes = CLASS_DURATION_MINUTES) {
  const startDate = start instanceof Date ? start : new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return { inWindow: false, status: "MISSING_INPUT", reason: "invalid_start" };
  }
  const day = dubaiWeekdayName(startDate);
  const window = CLASS_WINDOWS[day];
  if (!window) {
    return { inWindow: false, status: "OUTSIDE_WINDOW", reason: "unknown_day", day };
  }
  const startMin = dubaiMinutesOfDay(startDate);
  const endMin = startMin + durationMinutes;
  const openMin = parseHm(window.open);
  const closeMin = parseHm(window.close);
  if (startMin < openMin || endMin > closeMin) {
    return {
      inWindow: false,
      status: "OUTSIDE_WINDOW",
      reason: "outside_class_window",
      day,
      window,
      startMin,
      endMin,
    };
  }
  return { inWindow: true, status: null, day, window, startMin, endMin };
}

function occupancyBooked(event) {
  const booked = Number(event.bookedCount ?? 0);
  const capacity = Number(event.capacity ?? SESSION_CAPACITY[event.sessionType] ?? 1);
  return { booked: Math.max(0, booked), capacity: Math.max(1, capacity) };
}

/**
 * Determine availability against calendar occupancy events (source of truth).
 * Empty occupancy list ⇒ no bookings recorded ⇒ AVAILABLE if inside window.
 *
 * @param {{
 *   locationId: string,
 *   sessionType: SessionType,
 *   start: string|Date,
 *   durationMinutes?: number,
 *   coach?: string,
 *   occupancyEvents?: LessonOccupancy[],
 * }} input
 */
export function checkAvailability(input) {
  const locationId = resolveLocationId(input.locationId);
  const sessionType = normalizeSessionType(input.sessionType);
  const coach = input.coach || CURRENT_COACH;
  const duration = input.durationMinutes ?? CLASS_DURATION_MINUTES;
  const start = input.start instanceof Date ? input.start : new Date(input.start);
  const missing = [];
  if (!locationId) missing.push("locationId");
  if (!sessionType) missing.push("sessionType");
  if (Number.isNaN(start.getTime())) missing.push("start");
  if (missing.length) {
    return {
      status: "MISSING_INPUT",
      canBook: false,
      missing,
      availablePlaces: null,
      capacity: sessionType ? SESSION_CAPACITY[sessionType] : null,
    };
  }

  const windowCheck = evaluateClassWindow(start, duration);
  if (!windowCheck.inWindow) {
    return {
      status: "OUTSIDE_WINDOW",
      canBook: false,
      locationId,
      sessionType,
      coach,
      start: start.toISOString(),
      end: addMinutes(start, duration).toISOString(),
      availablePlaces: 0,
      capacity: SESSION_CAPACITY[sessionType],
      window: windowCheck.window,
      reason: windowCheck.reason,
    };
  }

  const end = addMinutes(start, duration);
  const events = Array.isArray(input.occupancyEvents) ? input.occupancyEvents : [];
  const overlapping = events.filter((ev) => {
    const evStart = ev.start instanceof Date ? ev.start : new Date(ev.start);
    const evEnd = ev.end instanceof Date ? ev.end : new Date(ev.end);
    if (Number.isNaN(evStart.getTime()) || Number.isNaN(evEnd.getTime())) return false;
    return overlaps(start, end, evStart, evEnd);
  });

  // Single coach: any overlapping occupancy for this coach blocks a conflicting private,
  // and blocks group unless it is the same location+group session with remaining places.
  const coachBusy = overlapping.filter((ev) => (ev.coach || CURRENT_COACH) === coach);

  if (sessionType === "private") {
    if (coachBusy.length > 0) {
      return {
        status: "BOOKED",
        canBook: false,
        locationId,
        sessionType,
        coach,
        start: start.toISOString(),
        end: end.toISOString(),
        availablePlaces: 0,
        capacity: 1,
        conflictingEventIds: coachBusy.map((e) => e.id).filter(Boolean),
      };
    }
    return {
      status: "AVAILABLE",
      canBook: true,
      locationId,
      sessionType,
      coach,
      start: start.toISOString(),
      end: end.toISOString(),
      availablePlaces: 1,
      capacity: 1,
    };
  }

  // group
  const capacity = SESSION_CAPACITY.group;
  const sameLocationGroup = coachBusy.filter(
    (ev) => ev.locationId === locationId && normalizeSessionType(ev.sessionType) === "group",
  );
  const otherConflicts = coachBusy.filter(
    (ev) => !(ev.locationId === locationId && normalizeSessionType(ev.sessionType) === "group"),
  );

  if (otherConflicts.length > 0) {
    return {
      status: "BOOKED",
      canBook: false,
      locationId,
      sessionType,
      coach,
      start: start.toISOString(),
      end: end.toISOString(),
      availablePlaces: 0,
      capacity,
      conflictingEventIds: otherConflicts.map((e) => e.id).filter(Boolean),
    };
  }

  if (sameLocationGroup.length === 0) {
    return {
      status: "AVAILABLE",
      canBook: true,
      locationId,
      sessionType,
      coach,
      start: start.toISOString(),
      end: end.toISOString(),
      availablePlaces: capacity,
      capacity,
      bookedCount: 0,
    };
  }

  // Merge booked counts across overlapping group events at same location (normally one event).
  let booked = 0;
  for (const ev of sameLocationGroup) {
    const { booked: b } = occupancyBooked(ev);
    booked += b;
  }
  const availablePlaces = Math.max(0, capacity - booked);
  if (availablePlaces <= 0) {
    return {
      status: "BOOKED",
      canBook: false,
      locationId,
      sessionType,
      coach,
      start: start.toISOString(),
      end: end.toISOString(),
      availablePlaces: 0,
      capacity,
      bookedCount: booked,
    };
  }
  if (availablePlaces < capacity) {
    return {
      status: "PARTIALLY_AVAILABLE",
      canBook: true,
      locationId,
      sessionType,
      coach,
      start: start.toISOString(),
      end: end.toISOString(),
      availablePlaces,
      capacity,
      bookedCount: booked,
    };
  }
  return {
    status: "AVAILABLE",
    canBook: true,
    locationId,
    sessionType,
    coach,
    start: start.toISOString(),
    end: end.toISOString(),
    availablePlaces: capacity,
    capacity,
    bookedCount: booked,
  };
}

/**
 * Build a Google Calendar event body for a real booking write (not executed here).
 */
export function buildLessonCalendarEvent({
  locationId,
  sessionType,
  start,
  bookedCount = 1,
  customerLabel = null,
  coach = CURRENT_COACH,
}) {
  const loc = SCHEDULE_LOCATIONS.find((l) => l.id === resolveLocationId(locationId));
  const type = normalizeSessionType(sessionType);
  if (!loc || !type) {
    throw new Error("locationId and sessionType are required");
  }
  const capacity = SESSION_CAPACITY[type];
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = addMinutes(startDate, CLASS_DURATION_MINUTES);
  const summary = `${type} | ${loc.name} | ${coach}`;
  const description = [
    `locationId=${loc.id}`,
    `sessionType=${type}`,
    `coach=${coach}`,
    `capacity=${capacity}`,
    `booked=${bookedCount}`,
    customerLabel ? `customer=${customerLabel}` : null,
    `map=${loc.mapUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    calendarId: LESSONS_CALENDAR.calendarId,
    summary,
    description,
    location: `${loc.name} — ${loc.mapUrl}`,
    start: { dateTime: startDate.toISOString(), timeZone: SCHEDULE_TIMEZONE },
    end: { dateTime: endDate.toISOString(), timeZone: SCHEDULE_TIMEZONE },
    extendedProperties: {
      private: {
        locationId: loc.id,
        sessionType: type,
        coach,
        capacity: String(capacity),
        booked: String(bookedCount),
      },
    },
  };
}

/**
 * Parse a Google Calendar event into LessonOccupancy.
 */
export function parseCalendarEventToOccupancy(event) {
  const privateProps = event?.extendedProperties?.private || {};
  const desc = String(event?.description || "");
  const pick = (key) => {
    if (privateProps[key] != null && privateProps[key] !== "") return privateProps[key];
    const m = desc.match(new RegExp(`${key}=([^\\n]+)`));
    return m ? m[1].trim() : null;
  };
  const locationId = resolveLocationId(pick("locationId") || event?.location || "");
  const sessionType = normalizeSessionType(pick("sessionType") || "");
  const capacity = Number(pick("capacity") || (sessionType ? SESSION_CAPACITY[sessionType] : 1));
  const bookedCount = Number(pick("booked") || pick("bookedCount") || 1);
  const coach = pick("coach") || CURRENT_COACH;
  const start = event?.start?.dateTime || event?.start?.date;
  const end = event?.end?.dateTime || event?.end?.date;
  return {
    id: event?.id || null,
    locationId,
    sessionType,
    coach,
    start,
    end,
    bookedCount: Number.isFinite(bookedCount) ? bookedCount : 1,
    capacity: Number.isFinite(capacity) ? capacity : 1,
  };
}
