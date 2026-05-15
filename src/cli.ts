import { Command } from "commander";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline/promises";
import { listModels } from "./llm/client.js";
import { runSolo } from "./modes/solo.js";
import { runChat } from "./modes/chat.js";
import { runPlan, runPlanInteractive } from "./modes/plan.js";
import { runAgent, runAgentInteractive } from "./modes/agent.js";
import {
  loadConfig,
  saveConfig,
  hasApiKey,
  promptApiKey,
  setRuntimeConfig,
} from "./config.js";
import {
  printHeader,
  printError,
  printInfo,
  printSuccess,
  bold,
  cyan,
  dim,
  yellow,
  divider,
  promptOneLine,
} from "./display.js";
import type { KimiCodeConfig, RunMode } from "./types.js";
import type { KimiModel } from "./types.js";

const _cli_dir = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(_cli_dir, "..", "package.json"), "utf-8"));
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

function parseInlineConfig(value: string): Partial<KimiCodeConfig> {
  const result: Partial<KimiCodeConfig> = {};
  const pairs = value.split(",");
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split("=");
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim();
    const rawValue = rest.join("=").trim();
    if (key === "api_key") result.api_key = rawValue;
    else if (key === "base_url") result.base_url = rawValue;
    else if (key === "model") result.model = rawValue as KimiCodeConfig["model"];
    else if (key === "max_tool_rounds") result.max_tool_rounds = Number(rawValue);
    else if (key === "auto_approve") result.auto_approve = rawValue === "true";
  }
  return result;
}

async function selectModel(preferred?: string): Promise<string> {
  const cfg = loadConfig();
  const models = await listModels().catch(() => []);
  const fallback = preferred || cfg.model;

  if (models.length === 0) return fallback;

  console.log(`\n${cyan("Available models:")}`);
  models.slice(0, 20).forEach((m, idx) => console.log(`  ${dim(String(idx + 1).padStart(2, "0"))} ${m}`));
  const answer = await promptOneLine(`Choose model [1-${Math.min(models.length, 20)}] or enter a name (default: ${fallback})`);
  if (!answer.trim()) return fallback;
  if (/^\d+$/.test(answer.trim())) {
    const idx = Number(answer.trim()) - 1;
    if (idx >= 0 && idx < models.length) return models[idx];
  }
  return answer.trim();
}

function toKimiModel(model: string): KimiModel {
  return model as KimiModel;
}

async function chooseMode(defaultMode: RunMode = "agent"): Promise<RunMode> {
  console.log(`\n${cyan("Mode:")} ${dim("solo / chat / plan / agent")}`);
  const answer = await promptOneLine(`Choose mode (default: ${defaultMode})`);
  const mode = answer.trim().toLowerCase();
  if (mode === "solo" || mode === "chat" || mode === "plan" || mode === "agent") return mode;
  return defaultMode;
}

async function collectTask(mode: RunMode): Promise<string> {
  if (mode === "chat") return "";
  const task = await promptOneLine(`Describe the task for ${mode}`);
  return task.trim();
}

async function startInteractiveSession(opts: { model?: string; mode?: RunMode; task?: string; }): Promise<void> {
  printHeader(opts.mode || "agent");
  if (!hasApiKey()) {
    printInfo("No API key found.");
    const key = await promptApiKey();
    saveConfig({ api_key: key });
    printSuccess("API key saved");
  }

  const selectedModel = await selectModel(opts.model);
  setRuntimeConfig({ model: selectedModel as KimiModel });
  printInfo(`Using model: ${selectedModel}`);

  const mode = opts.mode || await chooseMode("agent");
  const task = opts.task || await collectTask(mode);

  if (mode === "solo") {
    if (!task) return printError("Please provide a question.");
    await runSolo(task, { model: toKimiModel(selectedModel) });
    return;
  }

  if (mode === "chat") {
    await runChat({ model: toKimiModel(selectedModel) });
    return;
  }

  if (mode === "plan") {
    if (!task) return printError("Please provide a task.");
    await runPlanInteractive(task, { model: toKimiModel(selectedModel) });
    return;
  }

  if (mode === "agent") {
    if (task) {
      await runAgent(task, { model: toKimiModel(selectedModel) });
      return;
    }
    await runAgentInteractive({ model: toKimiModel(selectedModel) });
  }
}

/** Build and return the CLI program */
export function createCLI(): Command {
  const program = new Command();

  program
    .name("km")
    .description("Kimi-powered coding agent CLI - plan, code, review, and automate")
    .version(getVersion())
    .option("--api-key <key>", "Moonshot API key (overrides config/env)")
    .option("--model <model>", "Model name (overrides config/env)")
    .option("--mode <mode>", "Default mode when starting interactively (solo|chat|plan|agent)")
    .option("--task <task>", "Task to run immediately")
    .option("--verbose", "Enable verbose output")
  .option("--mode <mode>", "Default mode: solo|chat|plan|agent")
  .option("--task <task>", "Task to run immediately");

  program.hook("preAction", async (thisCommand) => {
    const opts = thisCommand.opts<{
      apiKey?: string;
      model?: string;
      mode?: RunMode;
      task?: string;
    }>();
    if (opts.apiKey) saveConfig({ api_key: opts.apiKey });
    if (opts.model) setRuntimeConfig({ model: opts.model as KimiCodeConfig["model"] });
  });

  program.command("init").description("Initialize km configuration").action(async () => {
    printHeader("solo");
    printInfo("Setting up km...\n");

    const existing = loadConfig();
    let apiKey = existing.api_key;
    if (!apiKey) {
      apiKey = await promptApiKey();
    }

    saveConfig({ api_key: apiKey });
    printSuccess("Configuration saved!");
    printInfo(`Config file: ~/.km/config.json`);
    printInfo(`API Base URL: ${existing.base_url}`);
    printInfo(`Default model: ${existing.model}`);
  });

  program.command("config")
    .description("View or update configuration")
    .option("--show", "Show current configuration")
    .option("--set <key=value>", "Set a config value (e.g., model=moonshot-v1-32k)")
    .action(async (opts) => {
      if (opts.show || (!opts.set && !opts.show)) {
        const cfg = loadConfig();
        printHeader("solo");
        printInfo("Current configuration:");
        console.log(`  ${bold("API Key:")}     ${cfg.api_key ? dim(`${cfg.api_key.slice(0, 8)}...`) : dim("(not set)")}`);
        console.log(`  ${bold("Base URL:")}    ${cfg.base_url}`);
        console.log(`  ${bold("Model:")}       ${cfg.model}`);
        console.log(`  ${bold("Auto approve:")} ${cfg.auto_approve}`);
        console.log(`  ${bold("Max rounds:")}   ${cfg.max_tool_rounds}`);
        return;
      }

      if (opts.set) {
        const eqIdx = opts.set.indexOf("=");
        if (eqIdx === -1) {
          printError("Use --set key=value format");
          return;
        }
        const key = opts.set.slice(0, eqIdx);
        let value: string | boolean | number = opts.set.slice(eqIdx + 1);
        if (value === "true") value = true;
        else if (value === "false") value = false;
        else if (!isNaN(Number(value))) value = Number(value);
        saveConfig({ [key]: value } as any);
        printSuccess(`Set ${key}=${value}`);
      }
    });

  program.command("doctor")
    .description("Diagnose configuration and connectivity")
    .action(async () => {
      printHeader("solo");
      printInfo("Running diagnostics...\n");

      // 1. Config file
      const { configDir, configPath: _cfgPath } = await import("./config.js");
      const cfgDir = configDir();
      const cfgPath = _cfgPath();
      const fsMod = await import("fs");
      const cfgExists = fsMod.existsSync(cfgPath);
      console.log("  " + bold("Config file:") + "     " + cfgPath);
      console.log("  " + bold("  Exists:") + "         " + (cfgExists ? green("yes") : red("no")));

      if (cfgExists) {
        try {
          const raw = fsMod.readFileSync(cfgPath, "utf-8");
          const parsed = JSON.parse(raw);
          const key = parsed.api_key || "";
          console.log("  " + bold("  API key:") + "        " + (key ? dim(key.slice(0, 8) + "...") : red("(empty)")));
          const keyValid = key.length > 0 && key !== ".done";
          console.log("  " + bold("  Key valid:") + "       " + (keyValid ? green("yes") : red("no")));
          console.log("  " + bold("  Base URL:") + "        " + (parsed.base_url || "(default)"));
          console.log("  " + bold("  Model:") + "           " + (parsed.model || "(default)"));
        } catch (e) {
          console.log("  " + bold("  Parse:") + "           " + red("corrupt"));
        }
      }
      console.log("");

      // 2. Environment
      console.log("  " + bold("Env vars:"));
      const hasKimi = !!process.env.KIMI_API_KEY;
      const hasMoonshot = !!process.env.MOONSHOT_API_KEY;
      console.log("  " + bold("  KIMI_API_KEY:") + "     " + (hasKimi ? green("set") : dim("not set")));
      console.log("  " + bold("  MOONSHOT_API_KEY:") + " " + (hasMoonshot ? green("set") : dim("not set")));
      console.log("  " + bold("  KIMI_BASE_URL:") + "    " + (process.env.KIMI_BASE_URL ? dim(process.env.KIMI_BASE_URL) : dim("not set")));
      console.log("");

      // 3. Network connectivity
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();
      if (cfg.api_key && cfg.api_key !== ".done") {
        console.log("  " + bold("Connectivity:"));
        try {
          const start = Date.now();
          const res = await fetch(cfg.base_url + "/models", {
            headers: { "Authorization": "Bearer " + cfg.api_key },
          });
          const ms = Date.now() - start;
          if (res.ok) {
            console.log("  " + bold("  API reachable:") + "   " + green("yes (" + ms + "ms)"));
            const data = await res.json();
            const models = data.data.filter((m) => m.id.startsWith("moonshot")).map((m) => m.id);
            console.log("  " + bold("  Models found:") + "    " + models.length);
            if (models.length > 0) {
              console.log("  " + bold("  Available:") + "       " + models.slice(0, 5).join(", ") + (models.length > 5 ? "... (+ " + (models.length - 5) + " more)" : ""));
            }
          } else {
            console.log("  " + bold("  API reachable:") + "   " + red("HTTP " + res.status));
          }
        } catch (e) {
          console.log("  " + bold("  API reachable:") + "   " + red(e instanceof Error ? e.message : String(e)));
        }
      }
      console.log("");

      // 4. Version
      const pkg = JSON.parse(fsMod.readFileSync(path.join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf-8"));
      console.log("  " + bold("Version:") + "          " + pkg.version);
      console.log("  " + bold("Node:") + "             " + process.version);
      console.log("  " + bold("Platform:") + "         " + process.platform + " " + process.arch);
    });

  program.command("models").description("List available Moonshot models").action(async () => {
    printHeader("solo");
    try {
      const models = await listModels();
      printInfo(`Available models (${models.length}):`);
      models.forEach((m) => console.log(`  ${dim("•")} ${m}`));
    } catch (err) {
      printError(`Failed to list models: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  program.command("solo")
    .description("Single Q&A mode - ask one question, get one answer")
    .argument("[question]", "Your question")
    .option("-m, --model <model>", "Model to use")
    .option("-t, --temperature <number>", "Temperature (0-2)", parseFloat)
    .action(async (question, opts) => {
      await checkApiKey();
      await runSolo(question, {
        model: opts.model ? toKimiModel(opts.model) : undefined,
        temperature: opts.temperature,
      });
    });

  program.command("chat")
    .description("Interactive chat mode - multi-turn conversation")
    .option("-m, --model <model>", "Model to use")
    .option("-t, --temperature <number>", "Temperature (0-2)", parseFloat)
    .action(async (opts) => {
      await checkApiKey();
      await runChat({
        model: opts.model ? toKimiModel(opts.model) : undefined,
        temperature: opts.temperature,
      });
    });

  program.command("plan")
    .description("Plan mode - analyze, plan, then execute step by step")
    .argument("<task>", "The task to plan and execute")
    .option("-m, --model <model>", "Model to use")
    .option("-t, --temperature <number>", "Temperature (0-2)", parseFloat)
    .option("-i, --interactive", "Interactive mode - approve plan before execution")
    .action(async (task, opts) => {
      await checkApiKey();
      if (opts.interactive) {
        await runPlanInteractive(task, {
          model: opts.model ? toKimiModel(opts.model) : undefined,
          temperature: opts.temperature,
        });
      } else {
        await runPlan(task, {
          model: opts.model ? toKimiModel(opts.model) : undefined,
          temperature: opts.temperature,
        });
      }
    });

  program.command("agent")
    .description("Agent mode - fully autonomous with file/shell tools")
    .argument("[task]", "The task for the agent to complete")
    .option("-m, --model <model>", "Model to use")
    .option("-t, --temperature <number>", "Temperature (0-2)", parseFloat)
    .option("--max-rounds <number>", "Max tool call rounds", parseInt)
    .option("-y, --yes", "Auto-approve all tool calls")
    .option("-i, --interactive", "Interactive agent mode (maintains context)")
    .action(async (task, opts) => {
      await checkApiKey();
      if (opts.interactive) {
        await runAgentInteractive({
          model: opts.model ? toKimiModel(opts.model) : undefined,
          temperature: opts.temperature,
          max_tool_rounds: opts.maxRounds,
          auto_approve: opts.yes,
        });
      } else if (task) {
        await runAgent(task, {
          model: opts.model ? toKimiModel(opts.model) : undefined,
          temperature: opts.temperature,
          max_tool_rounds: opts.maxRounds,
          auto_approve: opts.yes,
        });
      } else {
        printError("Please provide a task or use --interactive for interactive mode");
      }
    });

  program.action(async () => {
    const opts = program.opts<{
      apiKey?: string;
      model?: string;
      mode?: RunMode;
      task?: string;
    }>();
    await startInteractiveSession({
      model: opts.model,
      mode: opts.mode,
      task: opts.task,
    });
  });

  return program;
}

/** Check API key is available, prompt if not */
async function checkApiKey(): Promise<void> {
  if (hasApiKey()) return;
  printInfo("No API key found.");
  printInfo(`Set via:
  1. ${bold("km init")}
  2. Environment: ${bold("KIMI_API_KEY")}=sk-...
  3. CLI flag: ${bold("--api-key")}`);
  const key = await promptApiKey();
  saveConfig({ api_key: key });
  printSuccess("API key saved");
}
