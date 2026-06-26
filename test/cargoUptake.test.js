import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCargoUptake, convertStowageFactor } from "../src/domain/cargoUptake.js";

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

test("converts stowage factor in both directions", () => {
  assert.equal(convertStowageFactor(1, "cuft/mt", "cbm/mt"), 0.028316846592);
  assert.equal(Math.round(convertStowageFactor(1, "cbm/mt", "cuft/mt") * 1e9) / 1e9, 35.314666721);
});

test("uses cubic feet per metric tonne for the cubic cargo limit", () => {
  const result = calculateCargoUptake({
    summerDeadweightMt: 100000,
    summerDraftM: 15,
    loadPortMaxDraftM: 15,
    grainCapacityCbm: 97000,
    stowageFactor: 45,
    stowageFactorUnit: "cuft/mt"
  });

  assert.equal(result.stowageFactor.cbmPerMt, 1.274258);
  assert.equal(result.cubicLimitedCargoMt, 76122.73);
});

test("applies dock water allowance for brackish water", () => {
  const result = calculateCargoUptake({
    summerDeadweightMt: 81894.8,
    summerDraftM: 14.467,
    loadPortMaxDraftM: 11,
    tpcMt: 72,
    fwaMm: 331,
    waterDensity: 1.01,
    heavyFuelOilMt: 1000,
    dieselOilMt: 250,
    constantsMt: 420,
    freshwaterMt: 200,
    unpumpableBallastMt: 200
  });

  assert.equal(result.dockWaterAllowanceMm, 198.6);
  assert.equal(result.densityAdjustmentMt, -1429.92);
  assert.equal(result.maxCargoMt, 53432.48);
});

test("extrapolates dock water allowance for density below fresh water", () => {
  const result = calculateCargoUptake({
    summerDeadweightMt: 81894.8,
    summerDraftM: 14.467,
    loadPortMaxDraftM: 11,
    tpcMt: 72,
    fwaMm: 331,
    waterDensity: 0.997,
    heavyFuelOilMt: 1000,
    dieselOilMt: 250,
    constantsMt: 420,
    freshwaterMt: 200,
    unpumpableBallastMt: 200
  });

  assert.equal(result.dockWaterAllowanceMm, 370.72);
  assert.equal(result.densityAdjustmentMt, -2669.18);
  assert.equal(result.maxCargoMt, 52193.22);
});
