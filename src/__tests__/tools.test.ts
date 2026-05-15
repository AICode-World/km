import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("tools", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "kimi-code-test-"));
    // Create a test file
    writeFileSync(
      join(tmpDir, "test.txt"),
      "line 1\nline 2\nline 3\nline 4\nline 5\n",
      "utf-8"
    );
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should have tool definitions", async () => {
    const { getToolDefinitions } = await import("../tools/registry.js");
    const defs = getToolDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(7);
    const names = defs.map((d) => d.name);
    expect(names).toContain("Read");
    expect(names).toContain("Write");
    expect(names).toContain("Edit");
    expect(names).toContain("Bash");
    expect(names).toContain("Glob");
    expect(names).toContain("Grep");
    expect(names).toContain("Exit");
  });

  it("should read a file", async () => {
    const { executeTool } = await import("../tools/registry.js");
    const result = await executeTool("Read", { file_path: join(tmpDir, "test.txt") });
    expect(result.success).toBe(true);
    expect(result.output).toContain("line 1");
    expect(result.output).toContain("line 5");
  });

  it("should fail reading non-existent file", async () => {
    const { executeTool } = await import("../tools/registry.js");
    const result = await executeTool("Read", { file_path: "/nonexistent/file.txt" });
    expect(result.success).toBe(false);
  });

  it("should write a new file", async () => {
    const { executeTool } = await import("../tools/registry.js");
    const filePath = join(tmpDir, "newfile.txt");
    const result = await executeTool("Write", { file_path: filePath, content: "hello world" });
    expect(result.success).toBe(true);
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf-8")).toBe("hello world");
  });

  it("should edit a file", async () => {
    const { executeTool } = await import("../tools/registry.js");
    const filePath = join(tmpDir, "test.txt");
    const result = await executeTool("Edit", {
      file_path: filePath,
      old_text: "line 3",
      new_text: "edited line 3",
    });
    expect(result.success).toBe(true);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("edited line 3");
    expect(content).not.toContain("\nline 3\n");
  });

  it("should exit with a reason", async () => {
    const { executeTool } = await import("../tools/registry.js");
    const result = await executeTool("Exit", { reason: "All done" });
    expect(result.success).toBe(true);
    expect(result.output).toBe("All done");
  });

  it("should return error for unknown tool", async () => {
    const { executeTool } = await import("../tools/registry.js");
    const result = await executeTool("UnknownTool" as any, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown");
  });
});
