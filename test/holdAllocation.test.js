import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateGrain } from "../public/holdAllocation.js";
test("maximizes full holds and leaves central slack while conserving cargo", () => {
  const rows = allocateGrain([100,120,90,110,100,120,100], 1.2, 580);
  assert.equal(rows.filter(r => r.status === "FULL").length, 6);
  assert.equal(rows.find(r => r.status === "SLACK").hold, 4);
  assert.ok(Math.abs(rows.reduce((s,r) => s+r.cargoMt,0)-580) < 1e-8);
  assert.ok(rows.every(r => r.volumeCbm <= r.capacity));
});
test("low cargo maximizes full holds before central preference", () => {
  const rows=allocateGrain([20,100,20],1,45);
  assert.deepEqual(rows.map(r=>r.status),["FULL","SLACK","FULL"]);
});
test("handles empty cargo and caps loading at cubic capacity", () => {
  assert.ok(allocateGrain([10,20],1,0).every(r=>r.status === "EMPTY"));
  assert.ok(allocateGrain([10,20],1,100).every(r=>r.status === "FULL"));
  assert.throws(()=>allocateGrain([10],0,10));
});
