import { allocateGrain } from "/holdAllocation.js";
const form = document.querySelector("#uptake-form");
const result = document.querySelector("#result");
const questionnaireFile = document.querySelector("#questionnaire-file");
const uploadStatus = document.querySelector("#upload-status");
const uploadList = document.querySelector("#upload-list");
const analysisStatus = document.querySelector("#analysis-status");
const analysisSummary = document.querySelector("#analysis-summary");
const analysisNotes = document.querySelector("#analysis-notes");
const standardsPanel = document.querySelector("#panamax-standards");
const applyStandardsButton = document.querySelector("#apply-standards");
const standardsNote = document.querySelector("#standards-note");
const stowageFactorInput = form.querySelector('input[name="stowageFactor"]');
const stowageFactorUnit = form.querySelector('select[name="stowageFactorUnit"]');
const stowageFactorConversion = document.querySelector("#stowage-factor-conversion");
const taskForm = document.querySelector("#task-form");
const taskMessage = document.querySelector("#task-message");
const taskThread = document.querySelector("#task-thread");
const aiStatus = document.querySelector("#ai-status");
const STANDARDS_STORAGE_KEY = "loadicator.panamaxStandards";
const CUBIC_FEET_TO_CUBIC_METERS = 0.028316846592;
let previousStowageFactorUnit = stowageFactorUnit.value;
const analysisLists = {
  particulars: document.querySelector("#particulars-analysis"),
  cargoSpaces: document.querySelector("#capacity-analysis"),
  tankCapacities: document.querySelector("#tank-analysis"),
  voyageInputs: document.querySelector("#voyage-analysis")
};

function taskBubble(role, text, meta) {
  const bubble = document.createElement("div");
  const label = document.createElement("span");
  const content = document.createElement("div");
  bubble.className = `task-message ${role}`;
  label.className = "task-message-meta";
  label.textContent = meta;
  content.textContent = text;
  bubble.append(label, content);
  return bubble;
}

function renderTasks(tasks) {
  if (!tasks.length) return;
  const messages = [];
  for (const task of tasks.toReversed()) {
    messages.push(taskBubble("user", task.message, "Chartering request"));
    messages.push(
      taskBubble(
        "assistant",
        task.response || "Task saved locally. No background AI processor is connected yet.",
        task.response ? "Loadicator analysis" : "Queued for manual review"
      )
    );
  }
  taskThread.replaceChildren(...messages);
  taskThread.scrollTop = taskThread.scrollHeight;
}

async function loadTasks() {
  const response = await fetch("/api/tasks");
  if (response.ok) renderTasks((await response.json()).tasks);
}

async function loadAiStatus() {
  const response = await fetch("/api/ai/status");
  if (!response.ok) return;
  const status = await response.json();
  aiStatus.textContent = status.configured ? `AI ready · ${status.model}` : "Manual mode · API key missing";
  aiStatus.classList.toggle("reviewed", status.configured);
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = taskMessage.value.trim();
  if (!message) return;

  const submitButton = taskForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";
  try {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not submit task");
    taskMessage.value = "";
    await loadTasks();
  } catch (error) {
    taskThread.replaceChildren(taskBubble("assistant", error.message, "Submission error"));
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit task";
  }
});

function readNumericInputs(container) {
  return Object.fromEntries(
    Array.from(container.querySelectorAll("input[name]")).map((input) => [input.name, Number(input.value)])
  );
}

function setNamedInputs(container, values) {
  for (const [name, value] of Object.entries(values)) {
    const input = container.querySelector(`input[name="${name}"]`);
    if (input && Number.isFinite(Number(value))) input.value = value;
  }
}

function loadPanamaxStandards() {
  try {
    const saved = JSON.parse(localStorage.getItem(STANDARDS_STORAGE_KEY));
    if (saved) setNamedInputs(standardsPanel, saved);
  } catch {
    localStorage.removeItem(STANDARDS_STORAGE_KEY);
  }
}

applyStandardsButton.addEventListener("click", () => {
  const standards = readNumericInputs(standardsPanel);
  localStorage.setItem(STANDARDS_STORAGE_KEY, JSON.stringify(standards));
  setNamedInputs(form, standards);
  standardsNote.textContent = "Standards saved locally and applied to the current cargo scenario.";
  standardsNote.classList.add("saved");
});

function renderAnalysisItems(list, items) {
  list.replaceChildren(
    ...items.map((item) => {
      const row = document.createElement("div");
      const label = document.createElement("dt");
      const value = document.createElement("dd");
      label.textContent = item.label;
      value.textContent = item.value;
      if (item.source) {
        const source = document.createElement("small");
        source.textContent = item.source;
        value.append(source);
      }
      row.append(label, value);
      return row;
    })
  );
}

function renderAnalysis(analysis) {
  analysisStatus.textContent = "Reviewed";
  analysisStatus.className = "status-badge reviewed";
  analysisSummary.textContent = analysis.summary;
  analysisNotes.textContent = analysis.notes.join(" ");
  for (const [group, items] of Object.entries(analysis.groups)) {
    renderAnalysisItems(analysisLists[group], items);
  }
}

function markAnalysisPending(fileName) {
  analysisStatus.textContent = "Pending review";
  analysisStatus.className = "status-badge pending";
  analysisSummary.textContent = `${fileName} was uploaded. Structured extraction has not been reviewed yet.`;
  analysisNotes.textContent =
    "The file is stored locally. Found, calculated, and missing values will appear here after review.";
  for (const list of Object.values(analysisLists)) {
    renderAnalysisItems(list, [{ label: "Questionnaire", value: "Pending review" }]);
  }
}

async function loadAnalysis() {
  const response = await fetch("/api/questionnaires/analysis");
  if (response.ok) renderAnalysis((await response.json()).analysis);
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(Math.round(bytes / 1024), 1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderUploads(files) {
  uploadList.replaceChildren(
    ...files.map((file) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      const size = document.createElement("small");
      name.textContent = file.originalName;
      size.textContent = formatFileSize(file.size);
      item.append(name, size);
      return item;
    })
  );
}

async function loadUploads() {
  const response = await fetch("/api/questionnaires");
  if (response.ok) {
    renderUploads((await response.json()).files);
  }
}

questionnaireFile.addEventListener("change", async () => {
  const [file] = questionnaireFile.files;
  if (!file) return;

  uploadStatus.classList.remove("error");
  uploadStatus.textContent = `Uploading ${file.name}...`;

  try {
    const response = await fetch("/api/questionnaires", {
      method: "POST",
      headers: {
        "content-type": file.type || "application/octet-stream",
        "x-file-name": encodeURIComponent(file.name)
      },
      body: file
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Upload failed");

    uploadStatus.textContent = `${file.name} is ready for review.`;
    markAnalysisPending(file.name);
    questionnaireFile.value = "";
    await loadUploads();
  } catch (error) {
    uploadStatus.classList.add("error");
    uploadStatus.textContent = error.message;
  }
});

function formatMt(value) {
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} mt`;
}

function readFormData() {
  return {
    ...readNumericInputs(form),
    stowageFactorUnit: stowageFactorUnit.value
  };
}

function renderStowageFactorConversion() {
  const value = Number(stowageFactorInput.value);
  if (!Number.isFinite(value)) {
    stowageFactorConversion.textContent = "";
    return;
  }

  if (stowageFactorUnit.value === "cuft/mt") {
    stowageFactorConversion.textContent = `= ${(value * CUBIC_FEET_TO_CUBIC_METERS).toFixed(4)} m³/mt`;
  } else {
    stowageFactorConversion.textContent = `= ${(value / CUBIC_FEET_TO_CUBIC_METERS).toFixed(2)} ft³/mt`;
  }
}

stowageFactorInput.addEventListener("input", renderStowageFactorConversion);
stowageFactorUnit.addEventListener("change", () => {
  const value = Number(stowageFactorInput.value);
  if (Number.isFinite(value) && previousStowageFactorUnit !== stowageFactorUnit.value) {
    const converted =
      stowageFactorUnit.value === "cbm/mt"
        ? value * CUBIC_FEET_TO_CUBIC_METERS
        : value / CUBIC_FEET_TO_CUBIC_METERS;
    stowageFactorInput.value = converted.toFixed(stowageFactorUnit.value === "cbm/mt" ? 6 : 3);
  }
  previousStowageFactorUnit = stowageFactorUnit.value;
  renderStowageFactorConversion();
});

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
      <div class="result-row">
        <dt>Including unpumpable ballast</dt>
        <dd>${formatMt(data.unpumpableBallastMt)}</dd>
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

  const calculation = await response.json();
  renderResult(calculation);
  document.dispatchEvent(new CustomEvent("uptake-calculated", { detail: calculation }));
});

loadUploads();
loadAnalysis();
loadPanamaxStandards();
renderStowageFactorConversion();
loadTasks();
loadAiStatus();


async function loadVesselHolds() {
  const panel = document.querySelector("#vessel-holds");
  try {
    const response = await fetch("/api/vessel");
    if (!response.ok) return;
    const vessel = await response.json();
    document.querySelector("#vessel-name").textContent = `${vessel.name} · Basic ship · IMO ${vessel.imo}`;
    document.querySelector("#vessel-source").textContent = vessel.source;
    const number = value => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    function renderHolds() {
      const sf = Number(stowageFactorInput.value) * (stowageFactorUnit.value === "cuft/mt" ? CUBIC_FEET_TO_CUBIC_METERS : 1);
      const valid = Number.isFinite(sf) && sf > 0;
      document.querySelector("#hold-sf").textContent = valid ? `Current SF: ${sf.toFixed(6)} m³/mt` : "Enter a positive stowage factor.";
      document.querySelector("#hold-rows").replaceChildren(...vessel.holds.map((capacity, index) => {
        const row = document.createElement("tr");
        for (const value of [index + 1, number(capacity), valid ? number(capacity / sf) : "—"]) {
          const cell = document.createElement("td"); cell.textContent = value; row.append(cell);
        }
        return row;
      }));
      const total = vessel.holds.reduce((sum, value) => sum + value, 0);
      document.querySelector("#hold-total").textContent = `Total grain: ${number(total)} m³` + (valid ? ` · Cubic limit: ${number(total / sf)} mt` : "");
    }
    const holdDiagram = document.querySelector("#hold-diagram");
    const allocationSummary = document.querySelector("#allocation-summary");
    function clearAllocation() {
      holdDiagram.replaceChildren();
      allocationSummary.textContent = "Inputs changed. Press Calculate to update hold loading.";
    }
    form.addEventListener("input", clearAllocation);
    form.addEventListener("change", clearAllocation);
    applyStandardsButton.addEventListener("click", clearAllocation);
    document.addEventListener("uptake-calculated", ({ detail }) => {
      try {
        const sf = Number(stowageFactorInput.value) * (stowageFactorUnit.value === "cuft/mt" ? CUBIC_FEET_TO_CUBIC_METERS : 1);
        const totalCapacity = vessel.holds.reduce((a, b) => a + b, 0);
        if (Math.abs(Number(form.elements.grainCapacityCbm.value) - totalCapacity) > 0.01) throw new Error("Grain total differs from this vessel's holds. Apply vessel data first.");
        const rows = allocateGrain(vessel.holds, sf, detail.maxCargoMt);
        holdDiagram.replaceChildren(...rows.map(row => {
          const card = document.createElement("article");
          card.className = `hold-card ${row.status.toLowerCase()}`;
          card.innerHTML = `<h3>Hold ${row.hold}</h3><span class="hold-status">${row.status}</span>
            <div class="hold-tank"><div class="grain-fill" style="height:${row.percent}%"></div><strong>${row.percent.toFixed(1)}%</strong></div>
            <b>${number(row.cargoMt)} mt</b><small>${number(row.volumeCbm)} / ${number(row.capacity)} m³</small>`;
          return card;
        }));
        const loaded = rows.reduce((sum, row) => sum + row.cargoMt, 0);
        allocationSummary.textContent = `Grain: ${number(loaded)} mt · Full holds: ${rows.filter(row => row.status === "FULL").length} · Slack: ${rows.filter(row => row.status === "SLACK").map(row => row.hold).join(", ") || "none"} · Free volume: ${number(totalCapacity - loaded * sf)} m³. Percent shows volume, not physical cargo height.`;
      } catch (error) { holdDiagram.replaceChildren(); allocationSummary.textContent = error.message; }
    });
    document.querySelector("#apply-vessel").addEventListener("click", () => {
      setNamedInputs(form, vessel.inputs);
      stowageFactorUnit.value = "cbm/mt";
      previousStowageFactorUnit = "cbm/mt";
      renderStowageFactorConversion(); renderHolds(); form.requestSubmit();
    });
    stowageFactorInput.addEventListener("input", renderHolds);
    stowageFactorUnit.addEventListener("change", renderHolds);
    panel.hidden = false;
    document.querySelector("#apply-vessel").click();
  } catch (error) {
    panel.hidden = false;
    document.querySelector("#vessel-source").textContent = `Could not load holds: ${error.message}`;
  }
}
loadVesselHolds();
