import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TasksPanel } from "@/components/TasksPanel";

const mockNodes = [
  { id: "a", type: "nanoBanana", data: { status: "loading", customTitle: "Gen A" } },
  { id: "b", type: "llmGenerate", data: { status: "complete", customTitle: "LLM B" } },
  { id: "c", type: "generateVideo", data: { status: "error", error: "boom", customTitle: "Vid C" } },
  { id: "d", type: "prompt", data: { status: "idle" } },
];

vi.mock("@/store/workflowStore", () => ({
  useWorkflowStore: vi.fn((selector) => {
    const state = { nodes: mockNodes, isRunning: true };
    return selector ? selector(state) : state;
  }),
}));

describe("TasksPanel", () => {
  it("shows a running-count badge", () => {
    render(<TasksPanel />);
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("lists running/done/failed tasks, running first", () => {
    render(<TasksPanel />);
    fireEvent.click(screen.getByTitle("Tasks"));
    const genA = screen.getByText("Gen A");
    const vidC = screen.getByText("Vid C");
    const llmB = screen.getByText("LLM B");
    expect(genA).toBeTruthy();
    expect(vidC).toBeTruthy();
    expect(llmB).toBeTruthy();
    // idle nodes are not listed
    expect(screen.queryByText("prompt")).toBeNull();
    // order: running (Gen A) before error (Vid C) before done (LLM B)
    expect(genA.compareDocumentPosition(vidC) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(vidC.compareDocumentPosition(llmB) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the error message for failed tasks", () => {
    render(<TasksPanel />);
    fireEvent.click(screen.getByTitle("Tasks"));
    expect(screen.getByText("boom")).toBeTruthy();
  });
});
