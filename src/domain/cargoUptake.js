const SEA_WATER_DENSITY = 1.025;
const CUBIC_FEET_TO_CUBIC_METERS = 0.028316846592;

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function convertStowageFactor(value, fromUnit, toUnit) {
  const numericValue = numberOrZero(value);
  if (fromUnit === toUnit) return numericValue;
  if (fromUnit === "cuft/mt" && toUnit === "cbm/mt") return numericValue * CUBIC_FEET_TO_CUBIC_METERS;
  if (fromUnit === "cbm/mt" && toUnit === "cuft/mt") return numericValue / CUBIC_FEET_TO_CUBIC_METERS;
  throw new Error(`Unsupported stowage factor conversion: ${fromUnit} to ${toUnit}`);
}

export function calculateCargoUptake(input) {
  const summerDeadweightMt = numberOrZero(input.summerDeadweightMt);
  const summerDraftM = numberOrZero(input.summerDraftM);
  const loadPortMaxDraftM = numberOrZero(input.loadPortMaxDraftM);
  const tpcMt = numberOrZero(input.tpcMt);
  const grainCapacityCbm = numberOrZero(input.grainCapacityCbm);
  const hasUnitBasedStowageFactor = input.stowageFactor !== undefined;
  const stowageFactorInput = hasUnitBasedStowageFactor
    ? numberOrZero(input.stowageFactor)
    : numberOrZero(input.stowageFactorCbmPerMt);
  const stowageFactorUnit = hasUnitBasedStowageFactor ? input.stowageFactorUnit || "cuft/mt" : "cbm/mt";
  const stowageFactorCbmPerMt = convertStowageFactor(stowageFactorInput, stowageFactorUnit, "cbm/mt");
  const hasSplitFuel = input.heavyFuelOilMt !== undefined || input.dieselOilMt !== undefined;
  const heavyFuelOilMt = numberOrZero(input.heavyFuelOilMt);
  const dieselOilMt = numberOrZero(input.dieselOilMt);
  const bunkersMt = hasSplitFuel ? heavyFuelOilMt + dieselOilMt : numberOrZero(input.bunkersMt);
  const constantsMt = numberOrZero(input.constantsMt);
  const freshwaterMt = numberOrZero(input.freshwaterMt);
  const unpumpableBallastMt = numberOrZero(input.unpumpableBallastMt);
  const waterDensity = numberOrZero(input.waterDensity) || SEA_WATER_DENSITY;
  const fwaMm = numberOrZero(input.fwaMm);

  const deductionsMt = bunkersMt + constantsMt + freshwaterMt + unpumpableBallastMt;
  const deadweightLimitedCargoMt = Math.max(summerDeadweightMt - deductionsMt, 0);

  const draftGapM = loadPortMaxDraftM > 0 ? loadPortMaxDraftM - summerDraftM : 0;
  const draftAdjustmentMt = tpcMt > 0 ? draftGapM * 100 * tpcMt : 0;
  const densityDifference = SEA_WATER_DENSITY - waterDensity;
  const dockWaterAllowanceMm = fwaMm > 0 ? fwaMm * (densityDifference / 0.025) : 0;
  const densityAdjustmentMt = fwaMm > 0 && tpcMt > 0 ? -(dockWaterAllowanceMm / 10) * tpcMt : 0;
  const draftLimitedCargoMt = Math.max(summerDeadweightMt + draftAdjustmentMt + densityAdjustmentMt - deductionsMt, 0);

  const cubicLimitedCargoMt =
    grainCapacityCbm > 0 && stowageFactorCbmPerMt > 0
      ? grainCapacityCbm / stowageFactorCbmPerMt
      : Number.POSITIVE_INFINITY;

  const maxCargoMt = Math.min(deadweightLimitedCargoMt, draftLimitedCargoMt, cubicLimitedCargoMt);
  const limitingFactors = [];

  if (Math.abs(maxCargoMt - draftLimitedCargoMt) < 0.01) {
    limitingFactors.push("draft");
  }

  if (Math.abs(maxCargoMt - cubicLimitedCargoMt) < 0.01) {
    limitingFactors.push("cubic");
  }

  if (Math.abs(maxCargoMt - deadweightLimitedCargoMt) < 0.01) {
    limitingFactors.push("deadweight");
  }

  return {
    maxCargoMt: round(maxCargoMt, 2),
    limitingFactors,
    deadweightLimitedCargoMt: round(deadweightLimitedCargoMt, 2),
    draftLimitedCargoMt: round(draftLimitedCargoMt, 2),
    cubicLimitedCargoMt: Number.isFinite(cubicLimitedCargoMt) ? round(cubicLimitedCargoMt, 2) : null,
    deductionsMt: round(deductionsMt, 2),
    bunkersMt: round(bunkersMt, 2),
    heavyFuelOilMt: round(heavyFuelOilMt, 2),
    dieselOilMt: round(dieselOilMt, 2),
    unpumpableBallastMt: round(unpumpableBallastMt, 2),
    densityAdjustmentMt: round(densityAdjustmentMt, 2),
    dockWaterAllowanceMm: round(dockWaterAllowanceMm, 2),
    stowageFactor: {
      input: round(stowageFactorInput, 4),
      inputUnit: stowageFactorUnit,
      cbmPerMt: round(stowageFactorCbmPerMt, 6),
      cuftPerMt: round(convertStowageFactor(stowageFactorCbmPerMt, "cbm/mt", "cuft/mt"), 4)
    },
    assumptions: {
      waterDensity,
      densityCorrectionApplied: densityDifference === 0 || fwaMm > 0,
      note:
        densityDifference !== 0 && fwaMm <= 0
          ? "Density differs from seawater, but FWA is missing. Density correction was not applied."
          : "Pre-fixture estimate only. Final loading requires vessel-approved stability and strength checks."
    }
  };
}
