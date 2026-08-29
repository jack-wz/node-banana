import { describe, it, expect } from "vitest";
import { filterRecentWorkflows, RecentWorkflowEntry } from "../RecentWorkflowsGrid";

const entry = (name: string, directoryPath: string): RecentWorkflowEntry => ({
  name,
  directoryPath,
  relativePath: name,
  lastModified: 0,
});

const workflows = [
  entry("Product Shot Pipeline", "/workflows/product-shot"),
  entry("Character Sheet", "/workflows/character"),
  entry("背景替换", "/workflows/bg-swap"),
];

describe("filterRecentWorkflows", () => {
  it("returns all workflows for an empty query", () => {
    expect(filterRecentWorkflows(workflows, "")).toHaveLength(3);
    expect(filterRecentWorkflows(workflows, "   ")).toHaveLength(3);
  });

  it("matches by workflow name, case-insensitive", () => {
    expect(filterRecentWorkflows(workflows, "product")).toHaveLength(1);
    expect(filterRecentWorkflows(workflows, "SHEET")[0].name).toBe("Character Sheet");
  });

  it("matches by folder basename", () => {
    const result = filterRecentWorkflows(workflows, "bg-swap");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("背景替换");
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterRecentWorkflows(workflows, "nonexistent")).toHaveLength(0);
  });
});

