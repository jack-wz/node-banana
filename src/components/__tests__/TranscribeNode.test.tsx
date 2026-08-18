import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TranscribeNodeData } from "@/types";

const mockUpdateNodeData = vi.fn();
const mockRegenerateNode = vi.fn();
const mockUseWorkflowStore = vi.fn();

vi.mock("@/store/workflowStore", () => ({
  useWorkflowStore: (selector?: (state: unknown) => unknown) => {
    if (selector) {
      return mockUseWorkflowStore(selector);
    }
    return mockUseWorkflowStore((s: unknown) => s);
  },
}));

vi.mock("@xyflow/react", () => {
  const MockHandle = (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": `handle-${props.id}-${props.type}`,
      "data-handleid": props.id,
      "data-handletype": props["data-handletype"],
      "data-type": props.type,
      "data-position": props.position,
      className: `react-flow__handle react-flow__handle-${props.position}`,
      style: props.style,
    });
  return {
    Handle: MockHandle,
    NodeResizer: () => null,
    Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
    useReactFlow: () => ({
      getNodes: () => [],
      setNodes: vi.fn(),
      screenToFlowPosition: (pos: unknown) => pos,
    }),
    useConnection: (selector: (state: { inProgress: boolean }) => boolean) => selector({ inProgress: false }),
  };
});

vi.mock("@/components/Toast", () => ({
  useToast: { getState: () => ({ show: vi.fn() }) },
}));

vi.mock("@/hooks/useCommentNavigation", () => ({
  useCommentNavigation: () => null,
}));

vi.mock("@/components/nodes/BaseNode", () => {
  return {
    BaseNode: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(
        "div",
        { "data-testid": "base-node", "data-title": props.title },
        children as React.ReactNode
      ),
  };
});

import { TranscribeNode } from "@/components/nodes/TranscribeNode";

function setMockStoreState(overrides: Record<string, unknown> = {}) {
  const state = {
    updateNodeData: mockUpdateNodeData,
    regenerateNode: mockRegenerateNode,
    edges: [{ id: "e1", source: "gen1", target: "test-transcribe-1", targetHandle: "media" }],
    nodes: [{ id: "gen1", type: "generateVideo", data: { outputVideo: "blob:video1" } }],
    isRunning: false,
    currentNodeIds: [],
    groups: {},
    getNodesWithComments: vi.fn(() => []),
    markCommentViewed: vi.fn(),
    setNavigationTarget: vi.fn(),
    ...overrides,
  };
  mockUseWorkflowStore.mockImplementation((selector: (s: typeof state) => unknown) => selector(state));
}

const createNodeData = (overrides: Partial<TranscribeNodeData> = {}): TranscribeNodeData => ({
  language: "auto",
  outputSrt: null,
  status: "idle",
  error: null,
  progress: 0,
  ...overrides,
});

const createNodeProps = (data: Partial<TranscribeNodeData> = {}) => ({
  id: "test-transcribe-1",
  type: "transcribe" as const,
  data: createNodeData(data),
  selected: false,
  dragging: false,
  zIndex: 0,
  selectable: true,
  deletable: true,
  draggable: true,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
});

describe("TranscribeNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockStoreState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders media input and SRT output handles", () => {
    const { container } = render(<TranscribeNode {...createNodeProps()} />);
    expect(container.querySelector('[data-handleid="media"]')).toBeInTheDocument();
    expect(container.querySelector('[data-handleid="text"]')).toBeInTheDocument();
  });

  it("shows the ready hint when a source is connected but no transcript yet", () => {
    render(<TranscribeNode {...createNodeProps()} />);
    expect(screen.getByText("Click Transcribe to generate subtitles")).toBeInTheDocument();
  });

  it("shows the connect hint when no source is connected", () => {
    setMockStoreState({ edges: [] });
    render(<TranscribeNode {...createNodeProps()} />);
    expect(screen.getByText("Connect a video or audio input to transcribe")).toBeInTheDocument();
  });

  it("renders the language selector and writes changes", () => {
    render(<TranscribeNode {...createNodeProps()} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "zh" } });
    expect(mockUpdateNodeData).toHaveBeenCalledWith("test-transcribe-1", { language: "zh" });
  });

  it("enables the Transcribe button when a source is connected and calls regenerateNode", () => {
    render(<TranscribeNode {...createNodeProps()} />);
    const button = screen.getByRole("button", { name: "Transcribe" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(mockRegenerateNode).toHaveBeenCalledWith("test-transcribe-1");
  });

  it("disables the Transcribe button when no source is connected", () => {
    setMockStoreState({ edges: [] });
    render(<TranscribeNode {...createNodeProps()} />);
    expect(screen.getByRole("button", { name: "Transcribe" })).toBeDisabled();
  });

  it("renders the transcript preview and copy button when outputSrt is set", () => {
    render(
      <TranscribeNode {...createNodeProps({ outputSrt: "1\n00:00:00,000 --> 00:00:01,000\nHi" })} />
    );
    expect(screen.getByText(/00:00:00,000 --> 00:00:01,000/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy SRT" })).toBeInTheDocument();
  });
});
