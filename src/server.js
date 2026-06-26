import { createServer } from "node:http";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateCargoUptake } from "./domain/cargoUptake.js";

const PORT = Number(process.env.PORT) || 5173;
const ROOT = fileURLToPath(new URL("../public", import.meta.url));
const QUESTIONNAIRE_ROOT = fileURLToPath(new URL("../local-data/questionnaires", import.meta.url));
const ANALYSIS_ROOT = fileURLToPath(new URL("../local-data/questionnaire-analysis", import.meta.url));
const TASK_ROOT = fileURLToPath(new URL("../local-data/chartering-tasks", import.meta.url));
const ALLOWED_QUESTIONNAIRE_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx", ".xls"]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readRequestJson(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
  }

  return body ? JSON.parse(body) : {};
}

async function readRequestBuffer(request, maxBytes) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) throw new Error("File exceeds the 25 MB limit");
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function questionnaireName(request) {
  const encodedName = request.headers["x-file-name"];
  if (!encodedName || Array.isArray(encodedName)) throw new Error("File name is missing");

  const originalName = basename(decodeURIComponent(encodedName)).replace(/[\u0000-\u001f]/g, "");
  const extension = extname(originalName).toLowerCase();
  if (!originalName || !ALLOWED_QUESTIONNAIRE_EXTENSIONS.has(extension)) {
    throw new Error("Supported formats: PDF, DOCX, XLSX, and XLS");
  }

  return { originalName, extension };
}

async function listQuestionnaires() {
  await mkdir(QUESTIONNAIRE_ROOT, { recursive: true });
  const entries = await readdir(QUESTIONNAIRE_ROOT, { withFileTypes: true });
  const files = await Promise.all(
    entries.filter((entry) => entry.isFile()).map(async (entry) => {
      const fileStat = await stat(join(QUESTIONNAIRE_ROOT, entry.name));
      const originalName = entry.name.replace(/^\d+-/, "");
      return { originalName, size: fileStat.size, uploadedAt: fileStat.mtime.toISOString() };
    })
  );

  return files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

async function latestQuestionnaireAnalysis() {
  await mkdir(ANALYSIS_ROOT, { recursive: true });
  const entries = (await readdir(ANALYSIS_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((a, b) => b.name.localeCompare(a.name));

  if (!entries.length) return null;
  return JSON.parse(await readFile(join(ANALYSIS_ROOT, entries[0].name), "utf8"));
}

async function listTasks() {
  await mkdir(TASK_ROOT, { recursive: true });
  const entries = (await readdir(TASK_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((a, b) => b.name.localeCompare(a.name));
  return Promise.all(
    entries.slice(0, 20).map(async (entry) => JSON.parse(await readFile(join(TASK_ROOT, entry.name), "utf8")))
  );
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = normalize(join(ROOT, pathname));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, { ok: true, service: "loadicator" });
    return;
  }

  if (request.method === "POST" && request.url === "/api/uptake") {
    try {
      const payload = await readRequestJson(request);
      sendJson(response, 200, calculateCargoUptake(payload));
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Invalid uptake request" });
    }

    return;
  }

  if (request.method === "GET" && request.url === "/api/questionnaires") {
    sendJson(response, 200, { files: await listQuestionnaires() });
    return;
  }

  if (request.method === "GET" && request.url === "/api/questionnaires/analysis") {
    const analysis = await latestQuestionnaireAnalysis();
    if (!analysis) {
      sendJson(response, 404, { error: "No questionnaire has been reviewed yet" });
      return;
    }
    sendJson(response, 200, { analysis });
    return;
  }

  if (request.method === "POST" && request.url === "/api/questionnaires") {
    try {
      const { originalName } = questionnaireName(request);
      const content = await readRequestBuffer(request, MAX_UPLOAD_BYTES);
      if (!content.length) throw new Error("The selected file is empty");

      await mkdir(QUESTIONNAIRE_ROOT, { recursive: true });
      const safeName = originalName.replace(/[<>:"/\\|?*]/g, "_");
      const storedName = `${Date.now()}-${safeName}`;
      await writeFile(join(QUESTIONNAIRE_ROOT, storedName), content, { flag: "wx" });
      sendJson(response, 201, { file: { originalName, size: content.length } });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Invalid questionnaire upload" });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/api/tasks") {
    sendJson(response, 200, { tasks: await listTasks() });
    return;
  }

  if (request.method === "POST" && request.url === "/api/tasks") {
    try {
      const payload = await readRequestJson(request);
      const message = typeof payload.message === "string" ? payload.message.trim() : "";
      if (!message) throw new Error("Task text is required");
      if (message.length > 10000) throw new Error("Task text exceeds the 10,000 character limit");

      await mkdir(TASK_ROOT, { recursive: true });
      const createdAt = new Date().toISOString();
      const task = { id: `${Date.now()}`, createdAt, status: "pending", message, response: null };
      await writeFile(join(TASK_ROOT, `${task.id}.json`), JSON.stringify(task, null, 2), { flag: "wx" });
      sendJson(response, 201, { task });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Invalid chartering task" });
    }
    return;
  }

  if (request.method === "GET") {
    await serveStatic(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Loadicator dev server running at http://localhost:${PORT}`);
});
