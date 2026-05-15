// src/config.ts
import { homedir, platform } from "os";
import { join, resolve } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline/promises";

// src/types.ts
var DEFAULT_CONFIG = {
  api_key: "",
  base_url: "https://api.moonshot.cn/v1",
  model: "moonshot-v1-auto",
  max_tool_rounds: 25,
  auto_approve: false
};

// src/config.ts
var CONFIG_DIR_NAME = ".km";
var CONFIG_FILE_NAME = "config.json";
var runtimeOverrides = {};
function configDir() {
  const base = platform() === "win32" ? process.env.APPDATA || join(homedir(), "AppData", "Roaming") : process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, CONFIG_DIR_NAME);
}
function configPath() {
  return join(configDir(), CONFIG_FILE_NAME);
}
function ensureConfigDir() {
  const dir = configDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
function loadConfig() {
  const cfg = { ...DEFAULT_CONFIG };
  const cpath = configPath();
  if (existsSync(cpath)) {
    try {
      const raw = readFileSync(cpath, "utf-8");
      const parsed = JSON.parse(raw);
      Object.assign(cfg, parsed);
    } catch {
    }
  }
  if (process.env.KIMI_API_KEY) cfg.api_key = process.env.KIMI_API_KEY;
  if (process.env.MOONSHOT_API_KEY) cfg.api_key = process.env.MOONSHOT_API_KEY;
  if (process.env.KIMI_BASE_URL) cfg.base_url = process.env.KIMI_BASE_URL;
  if (process.env.KIMI_MODEL) cfg.model = process.env.KIMI_MODEL;
  if (runtimeOverrides.api_key !== void 0) cfg.api_key = runtimeOverrides.api_key;
  if (runtimeOverrides.base_url !== void 0) cfg.base_url = runtimeOverrides.base_url;
  if (runtimeOverrides.model !== void 0) cfg.model = runtimeOverrides.model;
  if (runtimeOverrides.max_tool_rounds !== void 0) cfg.max_tool_rounds = runtimeOverrides.max_tool_rounds;
  if (runtimeOverrides.auto_approve !== void 0) cfg.auto_approve = runtimeOverrides.auto_approve;
  return cfg;
}
function setRuntimeConfig(overrides) {
  runtimeOverrides = { ...runtimeOverrides, ...overrides };
}
function saveConfig(config) {
  ensureConfigDir();
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  writeFileSync(configPath(), JSON.stringify(merged, null, 2), "utf-8");
}
function hasApiKey() {
  const cfg = loadConfig();
  return cfg.api_key.length > 0;
}
async function promptApiKey() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const key = await rl.question("Enter your Moonshot API key: ");
  rl.close();
  return key.trim();
}
function resolvePath(p) {
  if (p.startsWith("~/") || p === "~") {
    return join(homedir(), p.slice(1));
  }
  return resolve(p);
}

export {
  configDir,
  configPath,
  loadConfig,
  setRuntimeConfig,
  saveConfig,
  hasApiKey,
  promptApiKey,
  resolvePath
};
