import { homedir, platform } from "os";
import { join, resolve } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline/promises";
import { DEFAULT_CONFIG, KimiCodeConfig } from "./types.js";

const CONFIG_DIR_NAME = ".km";
const CONFIG_FILE_NAME = "config.json";
let runtimeOverrides: Partial<KimiCodeConfig> = {};

function configDir(): string {
  const base = platform() === "win32"
    ? process.env.APPDATA || join(homedir(), "AppData", "Roaming")
    : process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, CONFIG_DIR_NAME);
}

function configPath(): string {
  return join(configDir(), CONFIG_FILE_NAME);
}

function ensureConfigDir(): void {
  const dir = configDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Load persisted config, merging with defaults */
export function loadConfig(): KimiCodeConfig {
  const cfg: KimiCodeConfig = { ...DEFAULT_CONFIG };

  // 1. Config file (lowest priority)
  const cpath = configPath();
  if (existsSync(cpath)) {
    try {
      const raw = readFileSync(cpath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<KimiCodeConfig>;
      Object.assign(cfg, parsed);
    } catch {
      // ignore corrupt config
    }
  }

  // 2. Environment variables (medium priority)
  if (process.env.KIMI_API_KEY) cfg.api_key = process.env.KIMI_API_KEY;
  if (process.env.MOONSHOT_API_KEY) cfg.api_key = process.env.MOONSHOT_API_KEY;
  if (process.env.KIMI_BASE_URL) cfg.base_url = process.env.KIMI_BASE_URL;
  if (process.env.KIMI_MODEL) cfg.model = process.env.KIMI_MODEL as KimiCodeConfig["model"];
  if (runtimeOverrides.api_key !== undefined) cfg.api_key = runtimeOverrides.api_key;
  if (runtimeOverrides.base_url !== undefined) cfg.base_url = runtimeOverrides.base_url;
  if (runtimeOverrides.model !== undefined) cfg.model = runtimeOverrides.model;
  if (runtimeOverrides.max_tool_rounds !== undefined) cfg.max_tool_rounds = runtimeOverrides.max_tool_rounds;
  if (runtimeOverrides.auto_approve !== undefined) cfg.auto_approve = runtimeOverrides.auto_approve;

  // 3. CLI --api-key would be handled by the CLI layer

  return cfg;
}

/** Apply runtime overrides from CLI flags */
export function setRuntimeConfig(overrides: Partial<KimiCodeConfig>): void {
  runtimeOverrides = { ...runtimeOverrides, ...overrides };
}

/** Persist config to disk */
export function saveConfig(config: Partial<KimiCodeConfig>): void {
  ensureConfigDir();
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  writeFileSync(configPath(), JSON.stringify(merged, null, 2), "utf-8");
}

/** Check if API key is configured */
export function hasApiKey(): boolean {
  const cfg = loadConfig();
  return cfg.api_key.length > 0;
}

/** Prompt user for API key via stdin */
export async function promptApiKey(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const key = await rl.question("Enter your Moonshot API key: ");
  rl.close();
  return key.trim();
}

/** Resolve a path relative to cwd, handling ~ */
export function resolvePath(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return join(homedir(), p.slice(1));
  }
  return resolve(p);
}

export { configDir, configPath };
