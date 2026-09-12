import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_AREA_ALIASES,
  RELAX_FIX_POOLS,
  findNearestPool,
  matchCustomerArea,
} from "../src/ai-sales-concierge/pools.mjs";

test("exactly four official pools with map links", () => {
  assert.equal(RELAX_FIX_POOLS.length, 4);
  for (const pool of RELAX_FIX_POOLS) {
    assert.ok(pool.mapUrl.startsWith("https://maps.app.goo.gl/"));
    assert.equal(pool.emirate, "Abu Dhabi");
    assert.ok(pool.sourceUrl.includes("/locations/"));
  }
});

test("nearest logic prefers named pool areas and differs across distant areas", () => {
  const falah = findNearestPool(matchCustomerArea("الفلاح"));
  const khalifa = findNearestPool(matchCustomerArea("Khalifa City"));
  const barsha = findNearestPool(matchCustomerArea("البرشاء"));
  const deira = findNearestPool(matchCustomerArea("ديرة"));
  assert.equal(falah.pool.id, "ics-al-falah");
  assert.equal(khalifa.pool.id, "ics-khalifa");
  assert.ok(barsha.pool.id);
  assert.ok(deira.pool.id);
  assert.notEqual(falah.pool.id, khalifa.pool.id);
});


test("customer area alias catalog covers required test areas", () => {
  const ids = new Set(CUSTOMER_AREA_ALIASES.map((a) => a.id));
  for (const id of ["al_barsha", "deira", "jvc", "marina", "al_falah", "al_mushrif"]) {
    assert.ok(ids.has(id), id);
  }
});
