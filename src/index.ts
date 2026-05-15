import { createCLI } from "./cli.js";
import { runChat } from "./modes/chat.js";
import { hasApiKey, promptApiKey, saveConfig } from "./config.js";
import { printHeader, printInfo, bold } from "./display.js";

async function main() {
  const program = createCLI();

  program.action(async () => {
    await ensureApiKey();
    printHeader("chat");
    await runChat({});
  });

  await program.parseAsync(process.argv);
}

async function ensureApiKey() {
  if (hasApiKey()) return;
  printInfo("No API key found.");
  printInfo("Set via:");
  printInfo("  1. " + bold("km init"));
  printInfo("  2. Environment: " + bold("KIMI_API_KEY") + "=sk-...");
  printInfo("  3. CLI flag: " + bold("--api-key"));
  const key = await promptApiKey();
  saveConfig({ api_key: key });
  printInfo("API key saved.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
