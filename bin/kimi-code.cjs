#!/usr/bin/env node
"use strict";

/**
 * kimi-code CLI entry point (CJS wrapper for ESM module)
 * Node.js treats .cjs as CommonJS regardless of "type":"module" in package.json,
 * allowing a proper shebang.
 */
import("./index.js").catch((err) => {
  console.error(err);
  process.exit(1);
});
