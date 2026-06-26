const SEA_WATER_DENSITY = 1.025;

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateCargoUptake(input) {
  const summerDeadweightMt = numberOrZero(input.summerDeadweightMt);
  const summerDraftM = numberOrZero(input.summerDraftM);
  const loadPortMaxDraftM = numberOrZero(input.loadPortMaxDraftM);
  const tpcMt = numberOrZero(input.tpcMt);
  const grainCapacityCbm = numberOrZero(input.grainCapacityCbm);
  const stowageFactorCbmPerMt = numberOrZero(input.stowageFactorCbmPerMt);
  const hasSplitFuel = input.heavyFuelOilMt !== undefined || input.dieselOilMt !== undefined;
  const heavyFuelOilMt = numberOrZero(input.heavyFuelOilMt);
  const dieselOilMt = numberOrZero(input.dieselOilMt);
  const bunkersMt = hasSplitFuel ? heavyFuelOilMt + dieselOilMt : numberOrZero(input.bunkersMt);
  const constantsMt = numberOrZero(input.constantsMt);
  const freshwaterMt = numberOrZero(input.freshwaterMt);
  const unpumpableBallastMt = numberOrZero(input.unpumpableBallastMt);
  const waterDensity = numberOrZero(input.waterDensity) || SEA_WATER_DENSITY;

  const deductionsMt = bunkersMt + constantsMt + freshwaterMt + unpumpableBallastMt;
  const deadweightLimitedCargoMt = Math.max(summerDeadweightMt - deductionsMt, 0);

  const draftGapM = loadPortMaxDraftM > 0 ? loadPortMaxDraftM - summerDraftM : 0;
  const draftAdjustmentMt = tpcMt > 0 ? draftGapM * 100 * tpcMt : 0;
  const densityAdjustmentMt =
    summerDeadweightMt > 0 ? summerDeadweightMt * ((waterDensity - SEA_WATER_DENSITY) / SEA_WATER_DENSITY) : 0;
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
    assumptions: {
      waterDensity,
      note: "Pre-fixture estimate only. Final loading requires vessel-approved stability and strength checks."
    }
  };
}
