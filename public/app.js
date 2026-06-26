const form = document.querySelector("#uptake-form");
const result = document.querySelector("#result");
const questionnaireFile = document.querySelector("#questionnaire-file");
const uploadStatus = document.querySelector("#upload-status");
const uploadList = document.querySelector("#upload-list");
const analysisStatus = document.querySelector("#analysis-status");
const analysisSummary = document.querySelector("#analysis-summary");
const analysisNotes = document.querySelector("#analysis-notes");
const analysisLists = {
  particulars: document.querySelector("#particulars-analysis"),
  cargoSpaces: document.querySelector("#capacity-analysis"),
  tankCapacities: document.querySelector("#tank-analysis"),
  voyageInputs: document.querySelector("#voyage-analysis")
};

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

  renderResult(await response.json());
});

loadUploads();
loadAnalysis();
