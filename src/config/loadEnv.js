import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ENV_PATH = fileURLToPath(new URL("../../.env.local", import.meta.url));

function unquote(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export async function loadLocalEnv() {
  try {
    const contents = await readFile(ENV_PATH, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = unquote(trimmed.slice(separator + 1).trim());
      if (process.env[key] === undefined && value) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
