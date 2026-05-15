import { describe, it, expect } from "vitest";

describe("prompts", () => {
  it("should build solo system prompt", async () => {
    const { buildSystemPrompt } = await import("../llm/prompts.js");
    const prompt = buildSystemPrompt("solo");
    expect(prompt).toContain("km");
    expect(prompt).toContain("Do NOT use any tools");
  });

  it("should build chat system prompt", async () => {
    const { buildSystemPrompt } = await import("../llm/prompts.js");
    const prompt = buildSystemPrompt("chat");
    expect(prompt).toContain("km");
    expect(prompt).toContain("Read");
    expect(prompt).toContain("Write");
  });

  it("should build plan system prompt", async () => {
    const { buildSystemPrompt } = await import("../llm/prompts.js");
    const prompt = buildSystemPrompt("plan");
    expect(prompt).toContain("plan mode");
    expect(prompt).toContain("Analyze");
    expect(prompt).toContain("Plan");
    expect(prompt).toContain("Execute");
  });

  it("should build agent system prompt", async () => {
    const { buildSystemPrompt } = await import("../llm/prompts.js");
    const prompt = buildSystemPrompt("agent");
    expect(prompt).toContain("agent mode");
    expect(prompt).toContain("Explore first");
    expect(prompt).toContain("Be precise");
  });

  it("should include extra hint when provided", async () => {
    const { buildSystemPrompt } = await import("../llm/prompts.js");
    const prompt = buildSystemPrompt("solo", "Extra context");
    expect(prompt).toContain("Extra context");
  });

  it("should have all 7 tool definitions", async () => {
    const { TOOL_DEFINITIONS } = await import("../llm/prompts.js");
    expect(TOOL_DEFINITIONS).toHaveLength(7);
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toEqual(["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Exit"]);
  });
});
