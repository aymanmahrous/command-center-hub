/**
 * Schedule helpers for Relax Fix UAE Messenger AI.
 * Owner-approved class windows live in availability.mjs.
 * Google Calendar "Relax Fix UAE Lessons" is the occupancy source of truth.
 * Windows alone never mean a slot is Available.
 */

import {
  CLASS_WINDOWS,
  LESSONS_CALENDAR,
  SCHEDULE_LOCATIONS,
} from "./availability.mjs";

export const SCHEDULE_SOURCE = {
  timezone: "Asia/Dubai",
  lessonsCalendar: LESSONS_CALENDAR,
  locations: SCHEDULE_LOCATIONS,
  classWindows: CLASS_WINDOWS,
  googleCalendarCredential: {
    n8nId: "uVP3oHdTvCq0b0fR",
    name: "Google Calendar account",
    connection: "VALID",
    dedicatedRelaxFixCalendar: true,
    calendarId: LESSONS_CALENDAR.calendarId,
  },
  recommendedSource: "GOOGLE_CALENDAR",
  /** Occupied times come only from Google Calendar / rf_lesson_occupancy mirror — never invented. */
  slotInventory: "google_calendar_occupancy",
  retrievedAt: "2026-08-14",
};

/** Owner-approved class windows (same as CLASS_WINDOWS). Windows ≠ auto-available slots. */
export const PUBLISHED_HOURS = {
  weekend: { days: ["saturday", "sunday"], open: "10:00", close: "22:00" },
  weekday: { days: ["monday", "tuesday", "wednesday", "thursday", "friday"], open: "16:00", close: "21:00" },
  disclaimer:
    "Approved class windows only. Actual availability requires Google Calendar occupancy check.",
};

// Timing/availability signals only — bare "book/حجز" stays in the booking funnel
// (which already refuses invented slots and hands off to Coach Ayman).
const SCHEDULE_INTENT_PATTERN =
  /(available|availability|slot|schedule|tomorrow|saturday|sunday|monday|tuesday|wednesday|thursday|friday|morning|evening|afternoon|after\s*\d|at\s*\d|موعد|بكرة|بكرا|غدا|غدًا|السبت|سبت|الأحد|الاحد|أحد|احد|اثنين|ثلاثاء|اربعاء|خميس|جمعة|صباح|مساء|بعد\s*\d|الساعة|الساعه|متاح|توفر|فيه\s*حصة|after\s*sunset|مغرب)/i;

export function isScheduleIntent(body) {
  return SCHEDULE_INTENT_PATTERN.test(body);
}

function parseHourHint(body) {
  const after = body.match(/(?:after|بعد)\s*(\d{1,2})/i);
  if (after) {
    let h = Number(after[1]);
    if (h <= 12 && /(مساء|evening|pm|مغرب)/i.test(body)) h = h === 12 ? 12 : h + 12;
    if (h < 12 && !/(صباح|am|morning)/i.test(body) && /(بعد)/i.test(body)) {
      // Arabic "بعد 6" usually evening in this business context
      if (h <= 6) h += 12;
    }
    return h;
  }
  const clock = body.match(/(?:at|الساعة|الساعه)\s*(\d{1,2})/i);
  if (clock) return Number(clock[1]);
  if (/(مغرب|after\s*sunset)/i.test(body)) return 19;
  if (/(evening|مساء|night|ليل)/i.test(body)) return 18;
  if (/(afternoon|ظهر)/i.test(body)) return 16;
  if (/(morning|صباح)/i.test(body)) return 10;
  return null;
}

function parseDayHint(body) {
  if (/(tomorrow|بكرة|بكرا|غدا|غدًا)/i.test(body)) return "tomorrow";
  if (/(saturday|السبت|سبت)/i.test(body)) return "saturday";
  if (/(sunday|الأحد|الاحد|أحد|احد)/i.test(body)) return "sunday";
  if (/(monday|الإثنين|الاثنين)/i.test(body)) return "monday";
  if (/(friday|الجمعة|جمعه|جمعة)/i.test(body)) return "friday";
  if (/(weekend|نهاية الأسبوع|ويكند)/i.test(body)) return "weekend";
  if (/(weekday|أيام الأسبوع)/i.test(body)) return "weekday";
  return null;
}

function hourInsidePublished(dayKind, hour) {
  if (hour == null) return "unknown";
  const window = dayKind === "weekend" ? PUBLISHED_HOURS.weekend : PUBLISHED_HOURS.weekday;
  const open = Number(window.open.split(":")[0]);
  const close = Number(window.close.split(":")[0]);
  if (hour >= open && hour < close) return "inside_published_window";
  return "outside_published_window";
}

function dayKindFromHint(dayHint, now = new Date()) {
  if (dayHint === "weekend" || dayHint === "saturday" || dayHint === "sunday") return "weekend";
  if (dayHint === "weekday" || ["monday", "friday"].includes(dayHint)) return "weekday";
  if (dayHint === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    return dow === 5 || dow === 6 || dow === 0 ? (dow === 5 ? "weekday" : "weekend") : "weekday";
    // Fri=5 weekday hours in UAE business copy (Mon-Fri); Sat=6 Sun=0 weekend
  }
  return null;
}

/**
 * @returns {{
 *   canConfirmSlot: false,
 *   dayHint: string|null,
 *   hourHint: number|null,
 *   publishedCheck: 'inside_published_window'|'outside_published_window'|'unknown',
 *   dayKind: 'weekend'|'weekday'|null
 * }}
 */
export function evaluateScheduleRequest(body, now = new Date()) {
  const dayHint = parseDayHint(body);
  const hourHint = parseHourHint(body);
  const dayKind = dayKindFromHint(dayHint, now);
  const publishedCheck =
    dayKind == null ? "unknown" : hourInsidePublished(dayKind, hourHint ?? (dayHint === "morning" ? 10 : null));

  // If only day known (e.g. Saturday morning via extractTiming style)
  let check = publishedCheck;
  if (dayKind && /(morning|صباح)/i.test(body)) {
    check = hourInsidePublished(dayKind, 10);
  } else if (dayKind && /(evening|مساء|مغرب)/i.test(body)) {
    check = hourInsidePublished(dayKind, 18);
  } else if (dayKind && hourHint != null) {
    check = hourInsidePublished(dayKind, hourHint);
  } else if (dayKind && hourHint == null) {
    check = "unknown";
  }

  return {
    canConfirmSlot: false,
    dayHint,
    hourHint,
    publishedCheck: check,
    dayKind,
  };
}

export function formatScheduleReply(language, { poolName, service, evaluation }) {
  const hoursAr =
    "ساعات النشر العامة: السبت والأحد 10:00–22:00، ومن الإثنين للجمعة 16:00–21:00 (ليست ضمان توفر).";
  const hoursEn =
    "Published general hours: Sat–Sun 10:00–22:00, Mon–Fri 16:00–21:00 (not a guarantee of open slots).";

  const loc =
    poolName
      ? language === "ar"
        ? `الموقع المقترح من سياقنا: ${poolName}.`
        : `Suggested location from our context: ${poolName}.`
      : "";

  const svc =
    service && ["private", "group", "siblings"].includes(service)
      ? language === "ar"
        ? `نوع الحصة المذكور: ${service === "private" ? "خاصة" : service === "group" ? "جماعية" : "إخوة"}.`
        : `Mentioned lesson type: ${service}.`
      : "";

  let windowNote = "";
  if (evaluation.publishedCheck === "inside_published_window") {
    windowNote =
      language === "ar"
        ? "الوقت اللي ذكرته يقع داخل ساعات النشر العامة، لكن هذا لا يعني أن الموعد متاح."
        : "That time falls inside published general hours, but that does NOT mean a slot is available.";
  } else if (evaluation.publishedCheck === "outside_published_window") {
    windowNote =
      language === "ar"
        ? "الوقت اللي ذكرته خارج ساعات النشر العامة على الموقع."
        : "That time is outside the website’s published general hours.";
  } else {
    windowNote =
      language === "ar"
        ? "ما عندي جدول لحظي للتحقق من المواعيد المتاحة فعليًا."
        : "I don’t have a live slot inventory to verify real availability.";
  }

  if (language === "ar") {
    return [
      "ما أقدر أأكد توفر موعد محدد من النظام الحالي.",
      windowNote,
      hoursAr,
      loc,
      svc,
      "أحوّل طلبك للكوتش أيمن لتأكيد أقرب موعد متاح فعليًا — بدون تخمين.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    "I can’t confirm a specific open slot from the current system.",
    windowNote,
    hoursEn,
    loc,
    svc,
    "I’ll pass this to Coach Ayman to confirm a real available time — no guessing.",
  ]
    .filter(Boolean)
    .join(" ");
}

export { SCHEDULE_INTENT_PATTERN };
