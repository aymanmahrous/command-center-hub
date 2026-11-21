import assert from "node:assert/strict";
import test from "node:test";
import { isOverdueFollowUp, matchesQueueStatus } from "../src/operations-queue-filter.ts";

test("overdue follow-ups include only past queued or retrying records", () => {
  assert.equal(isOverdueFollowUp("queued", true), true);
  assert.equal(isOverdueFollowUp("retrying", true), true);
  assert.equal(isOverdueFollowUp("queued", false), false);
  assert.equal(isOverdueFollowUp("failed", true), false);
});

test("overdue queue filter matches overdue follow-ups without changing other status filters", () => {
  assert.equal(matchesQueueStatus("queued", "overdue", true), true);
  assert.equal(matchesQueueStatus("retrying", "overdue", true), true);
  assert.equal(matchesQueueStatus("queued", "overdue", false), false);
  assert.equal(matchesQueueStatus("retrying", "queued", true), false);
  assert.equal(matchesQueueStatus("queued", "all"), true);
});
