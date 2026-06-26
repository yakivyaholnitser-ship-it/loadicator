import { calculateCargoUptake } from "../domain/cargoUptake.js";
import { CHARTERING_INPUT_SCHEMA, CHARTERING_INSTRUCTIONS } from "./charteringInstructions.js";

function outputText(response) {
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text") return content.text;
    }
  }
  throw new Error("OpenAI returned no structured output");
}

function withBusinessDefaults(input) {
  return {
    ...input,
    heavyFuelOilMt: input.heavyFuelOilMt ?? 1000,
    dieselOilMt: input.dieselOilMt ?? 250,
    constantsMt: input.constantsMt ?? 350,
    freshwaterMt: input.freshwaterMt ?? 200,
    unpumpableBallastMt: input.unpumpableBallastMt ?? 200,
    waterDensity: input.waterDensity ?? 1.025
  };
}

function formatNumber(value, decimals = 2) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function formatAnalysis(input, result) {
  const lines = [
    `PROVISIONAL MAX CARGO INTAKE: ${formatNumber(result.maxCargoMt)} mt`,
    "",
    `Vessel: ${input.vesselName || "Not identified"}`,
    `Governing draft: ${formatNumber(input.portMaxDraftM, 3)} m`,
    `Water density: ${input.waterDensity}`,
    `Limiting factor: ${result.limitingFactors.join(", ") || "not determined"}`,
    "",
    "Deductions:",
    `- HFO: ${formatNumber(input.heavyFuelOilMt)} mt`,
    `- Diesel oil: ${formatNumber(input.dieselOilMt)} mt`,
    `- Constants: ${formatNumber(input.constantsMt)} mt`,
    `- Fresh water: ${formatNumber(input.freshwaterMt)} mt`,
    `- Unpumpable ballast: ${formatNumber(input.unpumpableBallastMt)} mt`,
    `- Total: ${formatNumber(result.deductionsMt)} mt`,
    "",
    `Draft-limited cargo: ${formatNumber(result.draftLimitedCargoMt)} mt`,
    `Deadweight-limited cargo: ${formatNumber(result.deadweightLimitedCargoMt)} mt`,
    `Cubic-limited cargo: ${result.cubicLimitedCargoMt === null ? "Not tested" : `${formatNumber(result.cubicLimitedCargoMt)} mt`}`,
    `Density adjustment: ${formatNumber(result.densityAdjustmentMt)} mt`
  ];

  if (input.missingData.length) lines.push("", `Missing data: ${input.missingData.join("; ")}`);
  if (input.warnings.length) lines.push("", `Warnings: ${input.warnings.join("; ")}`);
  lines.push("", result.assumptions.note);
  return lines.join("\n");
}

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function analyzeCharteringTask(message, vesselContext) {
  if (!isOpenAiConfigured()) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      store: false,
      instructions: CHARTERING_INSTRUCTIONS,
      input: `CHARTERING TASK:\n${message}\n\nAVAILABLE VESSEL CONTEXT:\n${JSON.stringify(vesselContext)}`,
      text: {
        format: {
          type: "json_schema",
          name: "chartering_task_inputs",
          strict: true,
          schema: CHARTERING_INPUT_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI request failed (${response.status})`);
  }

  const extracted = withBusinessDefaults(JSON.parse(outputText(await response.json())));
  const result = calculateCargoUptake({
    ...extracted,
    loadPortMaxDraftM: extracted.portMaxDraftM
  });
  return { extracted, result, response: formatAnalysis(extracted, result) };
}
