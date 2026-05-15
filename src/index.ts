import { createCLI } from "./cli.js";

async function main() {
  const program = createCLI();

  // Parse args
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
