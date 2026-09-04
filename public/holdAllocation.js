// Volume allocation only; does not assess vessel stability or strength.
export function allocateGrain(capacities, sf, cargoMt) {
  if (!Array.isArray(capacities) || !capacities.length || capacities.length > 16 ||
      capacities.some(v => !Number.isFinite(v) || v <= 0) ||
      !Number.isFinite(sf) || sf <= 0 || !Number.isFinite(cargoMt) || cargoMt < 0) {
    throw new Error("Positive hold capacities and SF, and non-negative cargo are required.");
  }
  const total = capacities.reduce((a, b) => a + b, 0);
  const volume = Math.min(cargoMt * sf, total);
  const middle = (capacities.length - 1) / 2;
  let best;
  for (let mask = 0; mask < 2 ** capacities.length; mask++) {
    const full = capacities.map((_, i) => Boolean(mask & (1 << i)));
    const used = capacities.reduce((sum, c, i) => sum + (full[i] ? c : 0), 0);
    const remaining = volume - used;
    if (remaining < -1e-7) continue;
    const count = full.filter(Boolean).length;
    const slack = remaining <= 1e-7 ? -1 : capacities.map((_, i) => i)
      .filter(i => !full[i] && capacities[i] + 1e-7 >= remaining)
      .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0];
    if (slack === undefined) continue;
    const distance = slack === -1 ? -1 : Math.abs(slack - middle);
    if (!best || count > best.count || (count === best.count && distance < best.distance)) {
      best = { full, slack, remaining: Math.max(0, remaining), count, distance };
    }
  }
  return capacities.map((capacity, i) => {
    const volumeCbm = best.full[i] ? capacity : i === best.slack ? best.remaining : 0;
    return { hold: i + 1, capacity, volumeCbm, cargoMt: volumeCbm / sf,
      percent: volumeCbm / capacity * 100,
      status: best.full[i] ? "FULL" : volumeCbm > 1e-7 ? "SLACK" : "EMPTY" };
  });
}
