const form = document.querySelector("#uptake-form");
const result = document.querySelector("#result");

function formatMt(value) {
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} mt`;
}

function readFormData() {
  return Object.fromEntries(
    Array.from(new FormData(form).entries()).map(([key, value]) => [key, Number(value)])
  );
}

function renderResult(data) {
  const factors = data.limitingFactors.length ? data.limitingFactors.join(", ") : "none";

  result.innerHTML = `
    <p class="eyebrow">Result</p>
    <h2>Maximum cargo</h2>
    <div class="metric">${formatMt(data.maxCargoMt)}</div>
    <dl class="result-list">
      <div class="result-row">
        <dt>Limiting factor</dt>
        <dd>${factors}</dd>
      </div>
      <div class="result-row">
        <dt>Draft limited</dt>
        <dd>${formatMt(data.draftLimitedCargoMt)}</dd>
      </div>
      <div class="result-row">
        <dt>Deadweight limited</dt>
        <dd>${formatMt(data.deadweightLimitedCargoMt)}</dd>
      </div>
      <div class="result-row">
        <dt>Cubic limited</dt>
        <dd>${data.cubicLimitedCargoMt === null ? "N/A" : formatMt(data.cubicLimitedCargoMt)}</dd>
      </div>
      <div class="result-row">
        <dt>Deductions</dt>
        <dd>${formatMt(data.deductionsMt)}</dd>
      </div>
    </dl>
    <p class="notice">${data.assumptions.note}</p>
  `;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.innerHTML = '<p class="eyebrow">Result</p><h2>Calculating...</h2>';

  const response = await fetch("/api/uptake", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(readFormData())
  });

  if (!response.ok) {
    result.innerHTML = '<p class="eyebrow">Result</p><h2>Could not calculate</h2>';
    return;
  }

  renderResult(await response.json());
});
