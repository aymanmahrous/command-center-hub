import assert from "node:assert/strict";
import test from "node:test";
import { buildSalesConciergeTurn } from "../src/ai-sales-concierge/logic.mjs";
import {
  evaluateScheduleRequest,
  formatScheduleReply,
  isScheduleIntent,
  PUBLISHED_HOURS,
  SCHEDULE_SOURCE,
} from "../src/ai-sales-concierge/schedule.mjs";

function turn(messageBody, overrides = {}) {
  return buildSalesConciergeTurn({
    channel: "messenger",
    mode: "ai_active",
    language: "en",
    messageBody,
    intent: null,
    service: null,
    stage: "new",
    score: 0,
    fearOfWater: null,
    humanRequired: false,
    recentMessages: [],
    ...overrides,
  });
}

test("discovery records calendar occupancy source (not invented slots)", () => {
  assert.equal(SCHEDULE_SOURCE.slotInventory, "google_calendar_occupancy");
  assert.equal(SCHEDULE_SOURCE.googleCalendarCredential.connection, "VALID");
  assert.equal(SCHEDULE_SOURCE.googleCalendarCredential.dedicatedRelaxFixCalendar, true);
  assert.equal(SCHEDULE_SOURCE.recommendedSource, "GOOGLE_CALENDAR");
  assert.ok(PUBLISHED_HOURS.weekend.open);
  assert.ok(PUBLISHED_HOURS.weekday.open);
});

test("bare booking interest is not treated as inventable availability", () => {
  assert.equal(isScheduleIntent("أريد الحجز"), false);
  assert.equal(isScheduleIntent("I want to book"), false);
  assert.equal(isScheduleIntent("عندكم بكرة بعد 6؟"), true);
  assert.equal(isScheduleIntent("Can I book Saturday morning?"), true);
});

test("schedule replies never claim Available / invent slots", () => {
  const ar = turn("عندكم بكرة بعد 6؟");
  assert.equal(ar.canConfirmSlot, false);
  assert.equal(ar.detectedIntent, "schedule_handoff");
  assert.match(ar.draftReply, /ما أقدر أأكد توفر موعد|ساعات النشر العامة/i);
  assert.doesNotMatch(ar.draftReply, /\bAvailable\b|متاح الآن|عندنا موعد فاض|guaranteed available/i);

  const en = turn("Can I book Saturday morning?");
  assert.equal(en.canConfirmSlot, false);
  assert.match(en.draftReply, /can.?t confirm a specific open slot|published general hours/i);
  assert.doesNotMatch(en.draftReply, /yes we have a free slot|booked you in|you're confirmed|slot is free/i);
  assert.match(en.draftReply, /does NOT mean a slot is available/i);
});

test("private + khalidiya uses location context without inventing availability", () => {
  const result = turn("فيه حصة خاصة في خالدية؟");
  assert.equal(result.nextService, "private");
  assert.match(result.draftReply, /خاصة|private/i);
  assert.doesNotMatch(result.draftReply, /\bAvailable\b|احجز لك|I booked/i);
  // Khalidiya is not a trained area centroid in pools catalog; still no invented slots.
  assert.equal(result.canConfirmSlot, false);
});

test("prior pool context is reused on later schedule ask", () => {
  const located = turn("I'm in JVC, nearest pool?");
  assert.match(located.nextIntent, /presented_nearest_pool__/);
  const poolId = located.nearestPoolId;
  assert.ok(poolId);

  const schedule = turn("موعد بعد المغرب", {
    intent: located.nextIntent,
    service: "private",
    stage: located.nextStage,
    score: located.nextScore,
    language: "ar",
  });
  assert.equal(schedule.nearestPoolId, poolId);
  assert.match(schedule.nextIntent, new RegExp(`schedule_handoff__${poolId}`));
  assert.match(schedule.draftReply, /الموقع المقترح من سياقنا/i);
  assert.doesNotMatch(schedule.draftReply, /أي منطقة|which area/i);
});

test("combined nearest + schedule keeps honest handoff", () => {
  const result = turn("أنا في JVC وأبغى أقرب مكان وموعد بعد المغرب");
  assert.match(result.draftReply, /maps\.app\.goo\.gl/i);
  assert.match(result.draftReply, /ما أقدر أأكد|ساعات النشر/i);
  assert.equal(result.canConfirmSlot, false);
});

test("published-window evaluation is informative only", () => {
  // Saturday 10:00 is inside weekend published hours — still cannot confirm slot.
  const satMorning = evaluateScheduleRequest("Saturday morning");
  assert.equal(satMorning.canConfirmSlot, false);
  assert.equal(satMorning.publishedCheck, "inside_published_window");

  const reply = formatScheduleReply("en", {
    poolName: "ICS Mushrif",
    service: "private",
    evaluation: satMorning,
  });
  assert.match(reply, /does NOT mean a slot is available/i);
  assert.match(reply, /ICS Mushrif/);
});

test("outside published window is stated without inventing alternatives", () => {
  const evalResult = evaluateScheduleRequest("Monday morning at 9");
  assert.equal(evalResult.publishedCheck, "outside_published_window");
  const reply = formatScheduleReply("en", { poolName: null, service: null, evaluation: evalResult });
  assert.match(reply, /outside the website/i);
  assert.doesNotMatch(reply, /try 10am instead|I can book you/i);
});
