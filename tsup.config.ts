import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "bin",
  format: "esm",
  target: "node18",
  clean: true,
  platform: "node",
  external: ["readline/promises"],
  noExternal: [],
});
