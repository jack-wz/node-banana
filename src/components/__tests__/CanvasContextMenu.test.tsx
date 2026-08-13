import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CanvasContextMenu, CanvasContextMenuState } from "@/components/CanvasContextMenu";

vi.mock("@/store/workflowStore", () => ({
  useWorkflowStore: vi.fn(() => vi.fn()),
}));

vi.mock("@/store/ftuxStore", () => ({
  useFTUXStore: vi.fn(() => ({})),
}));

const makeProps = (menu: CanvasContextMenuState) => ({
  menu,
  nodeLocked: false,
  onAddNode: vi.fn(),
  onDuplicate: vi.fn(),
  onRename: vi.fn(),
  onToggleLock: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
});

describe("CanvasContextMenu — pane mode", () => {
  const paneMenu: CanvasContextMenuState = { x: 200, y: 150, mode: "pane" };

  it("renders the quick-add list with categories", () => {
    render(<CanvasContextMenu {...makeProps(paneMenu)} />);
    expect(screen.getByText("Add node")).toBeTruthy();
    expect(screen.getByText("Input")).toBeTruthy();
    expect(screen.getByText("Generate Image")).toBeTruthy();
  });

  it("clicking a node adds it at the menu screen position", () => {
    const props = makeProps(paneMenu);
    render(<CanvasContextMenu {...props} />);
    fireEvent.click(screen.getByText("Generate Image"));
    expect(props.onAddNode).toHaveBeenCalledWith("nanoBanana", 200, 150);
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("CanvasContextMenu — node mode", () => {
  const nodeMenu: CanvasContextMenuState = { x: 200, y: 150, mode: "node", nodeId: "node-1" };

  it("renders node actions", () => {
    render(<CanvasContextMenu {...makeProps(nodeMenu)} />);
    expect(screen.getByText("Duplicate")).toBeTruthy();
    expect(screen.getByText("Rename")).toBeTruthy();
    expect(screen.getByText("Lock")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("shows Unlock when the node is locked", () => {
    const props = { ...makeProps(nodeMenu), nodeLocked: true };
    render(<CanvasContextMenu {...props} />);
    expect(screen.getByText("Unlock")).toBeTruthy();
  });

  it("Duplicate calls onDuplicate with the node id", () => {
    const props = makeProps(nodeMenu);
    render(<CanvasContextMenu {...props} />);
    fireEvent.click(screen.getByText("Duplicate"));
    expect(props.onDuplicate).toHaveBeenCalledWith("node-1");
    expect(props.onClose).toHaveBeenCalled();
  });

  it("Delete calls onDelete with the node id", () => {
    const props = makeProps(nodeMenu);
    render(<CanvasContextMenu {...props} />);
    fireEvent.click(screen.getByText("Delete"));
    expect(props.onDelete).toHaveBeenCalledWith("node-1");
  });

  it("Rename and Lock call their handlers", () => {
    const props = makeProps(nodeMenu);
    render(<CanvasContextMenu {...props} />);
    fireEvent.click(screen.getByText("Rename"));
    expect(props.onRename).toHaveBeenCalledWith("node-1");
  });

  it("Escape closes the menu", () => {
    const props = makeProps(nodeMenu);
    render(<CanvasContextMenu {...props} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });
});
