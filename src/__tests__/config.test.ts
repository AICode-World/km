import { describe, it, expect } from "vitest";

describe("config", () => {
  it("should load with defaults", async () => {
    // Clear env vars for test
    const origKey = process.env.KIMI_API_KEY;
    delete process.env.KIMI_API_KEY;

    const { loadConfig } = await import("../config.js");
    const cfg = loadConfig();
    expect(cfg).toBeDefined();
    expect(cfg.base_url).toBe("https://api.moonshot.cn/v1");
    expect(cfg.model).toBe("moonshot-v1-auto");
    expect(cfg.max_tool_rounds).toBe(25);

    if (origKey) process.env.KIMI_API_KEY = origKey;
  });

  it("should read KIMI_API_KEY env var", async () => {
    process.env.KIMI_API_KEY = "sk-test-key";
    const { loadConfig } = await import("../config.js");
    const cfg = loadConfig();
    expect(cfg.api_key).toBe("sk-test-key");
    delete process.env.KIMI_API_KEY;
  });
});

describe("types", () => {
  it("should have correct DEFAULT_CONFIG", async () => {
    const { DEFAULT_CONFIG } = await import("../types.js");
    expect(DEFAULT_CONFIG.model).toBe("moonshot-v1-auto");
    expect(DEFAULT_CONFIG.base_url).toBe("https://api.moonshot.cn/v1");
    expect(DEFAULT_CONFIG.max_tool_rounds).toBe(25);
    expect(DEFAULT_CONFIG.auto_approve).toBe(false);
  });
});
