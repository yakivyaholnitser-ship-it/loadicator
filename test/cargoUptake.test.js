import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCargoUptake } from "../src/domain/cargoUptake.js";

test("calculates draft-limited cargo uptake", () => {
  const result = calculateCargoUptake({
    summerDeadweightMt: 82000,
    summerDraftM: 14.45,
    loadPortMaxDraftM: 13.6,
    tpcMt: 67,
    grainCapacityCbm: 97000,
    stowageFactorCbmPerMt: 1.25,
    bunkersMt: 900,
    constantsMt: 300,
    freshwaterMt: 120,
    waterDensity: 1.025
  });

  assert.equal(result.maxCargoMt, 74985);
  assert.deepEqual(result.limitingFactors, ["draft"]);
});

test("calculates cubic-limited cargo uptake", () => {
  const result = calculateCargoUptake({
    summerDeadweightMt: 82000,
    summerDraftM: 14.45,
    loadPortMaxDraftM: 14.45,
    tpcMt: 67,
    grainCapacityCbm: 50000,
    stowageFactorCbmPerMt: 1.5,
    bunkersMt: 900,
    constantsMt: 300,
    freshwaterMt: 120,
    waterDensity: 1.025
  });

  assert.equal(result.maxCargoMt, 33333.33);
  assert.deepEqual(result.limitingFactors, ["cubic"]);
});

test("deducts unpumpable ballast as metric tonnes", () => {
  const result = calculateCargoUptake({
    summerDeadweightMt: 82000,
    summerDraftM: 14.45,
    loadPortMaxDraftM: 14.45,
    tpcMt: 67,
    bunkersMt: 900,
    constantsMt: 300,
    freshwaterMt: 120,
    unpumpableBallastMt: 200
  });

  assert.equal(result.deductionsMt, 1520);
  assert.equal(result.unpumpableBallastMt, 200);
  assert.equal(result.maxCargoMt, 80480);
});

test("combines Panamax standard HFO and diesel oil as bunkers", () => {
  const result = calculateCargoUptake({
    summerDeadweightMt: 82000,
    summerDraftM: 14.45,
    loadPortMaxDraftM: 14.45,
    tpcMt: 67,
    heavyFuelOilMt: 1000,
    dieselOilMt: 250,
    constantsMt: 350,
    freshwaterMt: 200,
    unpumpableBallastMt: 200
  });

  assert.equal(result.bunkersMt, 1250);
  assert.equal(result.deductionsMt, 2000);
  assert.equal(result.maxCargoMt, 80000);
});
