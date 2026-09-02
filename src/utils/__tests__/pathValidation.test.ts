// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateWorkflowPath,
  validateWorkflowPathDeep,
  isSafePathComponent,
} from "../pathValidation";

describe("validateWorkflowPath", () => {
  it("rejects relative paths", () => {
    expect(validateWorkflowPath("foo/bar").valid).toBe(false);
  });

  it("rejects traversal sequences", () => {
    expect(validateWorkflowPath("/tmp/../etc").valid).toBe(false);
  });

  it("rejects system directories", () => {
    for (const p of ["/etc", "/etc/nginx", "/usr/local", "/System/Library", "/Library"]) {
      expect(validateWorkflowPath(p).valid).toBe(false);
    }
  });

  it("accepts ordinary absolute paths", () => {
    expect(validateWorkflowPath("/tmp/some-workflow").valid).toBe(true);
  });
});

describe("validateWorkflowPathDeep", () => {
  let tempDir = "";

  afterAll(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("rejects macOS /private real paths directly", async () => {
    const result = await validateWorkflowPathDeep("/private/etc");
    expect(result.valid).toBe(false);
  });

  it("rejects a symlink whose target is a system directory", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nb-pathval-"));
    const link = join(tempDir, "etc-link");
    await symlink("/etc", link);
    const result = await validateWorkflowPathDeep(link);
    expect(result.valid).toBe(false);
  });

  it("accepts a real temporary directory (symlinked /tmp included)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nb-pathval-ok-"));
    const result = await validateWorkflowPathDeep(dir);
    expect(result.valid).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it("falls back to sync checks for paths that do not exist yet", async () => {
    const result = await validateWorkflowPathDeep("/tmp/nb-does-not-exist-yet");
    expect(result.valid).toBe(true);
  });
});

describe("isSafePathComponent", () => {
  it("accepts plain file names", () => {
    expect(isSafePathComponent("generation_ab12cd")).toBe(true);
    expect(isSafePathComponent("my-file_01")).toBe(true);
  });

  it("rejects traversal and separators", () => {
    expect(isSafePathComponent("../secret")).toBe(false);
    expect(isSafePathComponent("..")).toBe(false);
    expect(isSafePathComponent("a/b")).toBe(false);
    expect(isSafePathComponent("a" + String.fromCharCode(92) + "b")).toBe(false);
    expect(isSafePathComponent("")).toBe(false);
  });
});
