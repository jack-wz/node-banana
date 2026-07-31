import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodePickerMenu } from "@/components/NodePickerMenu";

vi.mock("@/store/workflowStore", () => ({
  useWorkflowStore: vi.fn(() => vi.fn()),
}));

vi.mock("@/store/ftuxStore", () => ({
  useFTUXStore: vi.fn(() => ({})),
}));

const defaultProps = () => ({
  x: 100,
  y: 100,
  onSelect: vi.fn(),
  onClose: vi.fn(),
});

describe("NodePickerMenu", () => {
  it("renders the search input and node categories", () => {
    render(<NodePickerMenu {...defaultProps()} />);
    expect(screen.getByPlaceholderText("Search nodes…")).toBeTruthy();
    expect(screen.getByText("Generate Image")).toBeTruthy();
    expect(screen.getByText("Prompt")).toBeTruthy();
  });

  it("focuses the search input on mount", () => {
    render(<NodePickerMenu {...defaultProps()} />);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Search nodes…"));
  });

  it("filters nodes by substring query", () => {
    render(<NodePickerMenu {...defaultProps()} />);
    const input = screen.getByPlaceholderText("Search nodes…");
    fireEvent.change(input, { target: { value: "llm" } });
    expect(screen.getByText("LLM Generate")).toBeTruthy();
    expect(screen.queryByText("Generate Image")).toBeNull();
  });

  it("supports fuzzy subsequence matching", () => {
    render(<NodePickerMenu {...defaultProps()} />);
    const input = screen.getByPlaceholderText("Search nodes…");
    fireEvent.change(input, { target: { value: "gv" } });
    expect(screen.getByText("Generate Video")).toBeTruthy();
  });

  it("Enter selects the active item", () => {
    const props = defaultProps();
    render(<NodePickerMenu {...props} />);
    const input = screen.getByPlaceholderText("Search nodes…");
    fireEvent.change(input, { target: { value: "llm" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSelect).toHaveBeenCalledWith("llmGenerate");
  });

  it("ArrowDown + Enter selects the second item", () => {
    const props = defaultProps();
    render(<NodePickerMenu {...props} />);
    const input = screen.getByPlaceholderText("Search nodes…");
    fireEvent.change(input, { target: { value: "video" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    // "video" matches Video Input first, then Generate Video
    expect(props.onSelect).toHaveBeenCalledWith("generateVideo");
  });

  it("Escape closes the menu", () => {
    const props = defaultProps();
    render(<NodePickerMenu {...props} />);
    fireEvent.keyDown(screen.getByPlaceholderText("Search nodes…"), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("clicking an item selects it", () => {
    const props = defaultProps();
    render(<NodePickerMenu {...props} />);
    fireEvent.click(screen.getByText("Prompt"));
    expect(props.onSelect).toHaveBeenCalledWith("prompt");
  });

  it("shows empty state when nothing matches", () => {
    render(<NodePickerMenu {...defaultProps()} />);
    fireEvent.change(screen.getByPlaceholderText("Search nodes…"), { target: { value: "zzzzzz" } });
    expect(screen.getByText("No matching nodes")).toBeTruthy();
  });
});
