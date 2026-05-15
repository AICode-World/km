import { Command } from "commander";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const _cli_dir = dirname(fileURLToPath(import.meta.url));
function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(_cli_dir, "..", "package.json"), "utf-8"));
    return pkg.version;
  } catch { return "0.0.0"; }
}
import { loadConfig, saveConfig, hasApiKey, promptApiKey } from "./config.js";
import { listModels } from "./llm/client.js";
import { runSolo } from "./modes/solo.js";
import { runChat } from "./modes/chat.js";
import { runPlan, runPlanInteractive } from "./modes/plan.js";
import { runAgent, runAgentInteractive } from "./modes/agent.js";
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
} from "./display.js";

/** Build and return the CLI program */
export function createCLI(): Command {
  const program = new Command();

  program
    .name("km")
    .description("Kimi-powered coding agent CLI — plan, code, review, and automate")
    .version(getVersion())
    .option("--api-key <key>", "Moonshot API key (overrides config/env)")
    .option("--model <model>", "Model name (overrides config/env)")
    .option("--verbose", "Enable verbose output");

  // ── init ────────────────────────────────────────────────
  program
    .command("init")
    .description("Initialize km configuration")
    .action(async () => {
      printHeader("solo");
      printInfo("Setting up kimi-code...\n");

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

  // ── config ──────────────────────────────────────────────
  program
    .command("config")
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

  // ── models ──────────────────────────────────────────────
  program
    .command("models")
    .description("List available Moonshot models")
    .action(async () => {
      printHeader("solo");
      try {
        const models = await listModels();
        printInfo(`Available models (${models.length}):`);
        models.forEach((m) => console.log(`  ${dim("•")} ${m}`));
      } catch (err) {
        printError(`Failed to list models: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

  // ── solo ────────────────────────────────────────────────
  program
    .command("solo")
    .description("Single Q&A mode — ask one question, get one answer")
    .argument("[question]", "Your question")
    .option("-m, --model <model>", "Model to use")
    .option("-t, --temperature <number>", "Temperature (0-2)", parseFloat)
    .action(async (question, opts) => {
      await checkApiKey();
      await runSolo(question, {
        model: opts.model,
        temperature: opts.temperature,
      });
    });

  // ── chat ────────────────────────────────────────────────
  program
    .command("chat")
    .description("Interactive chat mode — multi-turn conversation")
    .option("-m, --model <model>", "Model to use")
    .option("-t, --temperature <number>", "Temperature (0-2)", parseFloat)
    .action(async (opts) => {
      await checkApiKey();
      await runChat({
        model: opts.model,
        temperature: opts.temperature,
      });
    });

  // ── plan ────────────────────────────────────────────────
  program
    .command("plan")
    .description("Plan mode — analyze, plan, then execute step by step")
    .argument("<task>", "The task to plan and execute")
    .option("-m, --model <model>", "Model to use")
    .option("-t, --temperature <number>", "Temperature (0-2)", parseFloat)
    .option("-i, --interactive", "Interactive mode — approve plan before execution")
    .action(async (task, opts) => {
      await checkApiKey();
      if (opts.interactive) {
        await runPlanInteractive(task, {
          model: opts.model,
          temperature: opts.temperature,
        });
      } else {
        await runPlan(task, {
          model: opts.model,
          temperature: opts.temperature,
        });
      }
    });

  // ── agent ───────────────────────────────────────────────
  program
    .command("agent")
    .description("Agent mode — fully autonomous with file/shell tools")
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
          model: opts.model,
          temperature: opts.temperature,
          max_tool_rounds: opts.maxRounds,
          auto_approve: opts.yes,
        });
      } else if (task) {
        await runAgent(task, {
          model: opts.model,
          temperature: opts.temperature,
          max_tool_rounds: opts.maxRounds,
          auto_approve: opts.yes,
        });
      } else {
        printError("Please provide a task or use --interactive for interactive mode");
      }
    });

  return program;
}

/** Check API key is available, prompt if not */
async function checkApiKey(): Promise<void> {
  if (hasApiKey()) return;
  printInfo("No API key found.");
  printInfo(`Set via:\n  1. ${bold("km init")}\n  2. Environment: ${bold("KIMI_API_KEY")}=sk-...\n  3. CLI flag: ${bold("--api-key")}`);
  const key = await promptApiKey();
  saveConfig({ api_key: key });
  printSuccess("API key saved");
}
