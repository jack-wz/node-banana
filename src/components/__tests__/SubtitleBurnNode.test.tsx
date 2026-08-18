import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubtitleBurnNodeData } from "@/types";

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

const mockCheckEncoderSupport = vi.fn();
vi.mock("@/hooks/useStitchVideos", () => ({
  checkEncoderSupport: () => mockCheckEncoderSupport(),
}));

vi.mock("@/hooks/useVideoBlobUrl", () => ({
  useVideoBlobUrl: (url: string | null) => url,
}));

vi.mock("@/hooks/useVideoAutoplay", () => ({
  useVideoAutoplay: () => ({ current: null }),
}));

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

import { SubtitleBurnNode } from "@/components/nodes/SubtitleBurnNode";

function setMockStoreState(overrides: Record<string, unknown> = {}) {
  const state = {
    updateNodeData: mockUpdateNodeData,
    regenerateNode: mockRegenerateNode,
    edges: [{ id: "e1", source: "gen1", target: "test-subburn-1", targetHandle: "video" }],
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

const createNodeData = (overrides: Partial<SubtitleBurnNodeData> = {}): SubtitleBurnNodeData => ({
  srtText: "1\n00:00:00,000 --> 00:00:01,000\nHi",
  srtSource: "manual",
  stylePreset: "default",
  position: "bottom",
  outputVideo: null,
  status: "idle",
  error: null,
  progress: 0,
  encoderSupported: true,
  ...overrides,
});

const createNodeProps = (data: Partial<SubtitleBurnNodeData> = {}) => ({
  id: "test-subburn-1",
  type: "subtitleBurn" as const,
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

describe("SubtitleBurnNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckEncoderSupport.mockResolvedValue(true);
    setMockStoreState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders video, srt, and output handles", () => {
    const { container } = render(<SubtitleBurnNode {...createNodeProps()} />);
    const handles = container.querySelectorAll(".react-flow__handle");
    expect(handles.length).toBe(3);
    expect(container.querySelector('[data-handleid="srt"]')).toBeInTheDocument();
  });

  it("shows the connect hint when no video is connected", () => {
    setMockStoreState({ edges: [] });
    render(<SubtitleBurnNode {...createNodeProps()} />);
    expect(screen.getByText("Connect a video and SRT text to burn subtitles")).toBeInTheDocument();
  });

  it("hand-editing the SRT textarea marks the source as manual", () => {
    render(<SubtitleBurnNode {...createNodeProps({ srtSource: "connected" })} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "edited" } });
    expect(mockUpdateNodeData).toHaveBeenCalledWith("test-subburn-1", {
      srtText: "edited",
      srtSource: "manual",
    });
  });

  it("mirrors a connected transcribe node's SRT into srtText when not hand-edited", () => {
    setMockStoreState({
      edges: [
        { id: "e1", source: "gen1", target: "test-subburn-1", targetHandle: "video" },
        { id: "e2", source: "tr1", target: "test-subburn-1", targetHandle: "srt" },
      ],
      nodes: [
        { id: "gen1", type: "generateVideo", data: { outputVideo: "blob:video1" } },
        { id: "tr1", type: "transcribe", data: { outputSrt: "1\n00:00:00,000 --> 00:00:01,000\nSynced" } },
      ],
    });

    render(<SubtitleBurnNode {...createNodeProps({ srtText: "", srtSource: "connected" })} />);

    expect(mockUpdateNodeData).toHaveBeenCalledWith("test-subburn-1", {
      srtText: "1\n00:00:00,000 --> 00:00:01,000\nSynced",
      srtSource: "connected",
    });
  });

  it("does not overwrite hand-edited SRT when the connected input changes", () => {
    setMockStoreState({
      edges: [
        { id: "e1", source: "gen1", target: "test-subburn-1", targetHandle: "video" },
        { id: "e2", source: "tr1", target: "test-subburn-1", targetHandle: "srt" },
      ],
      nodes: [
        { id: "gen1", type: "generateVideo", data: { outputVideo: "blob:video1" } },
        { id: "tr1", type: "transcribe", data: { outputSrt: "new connected srt" } },
      ],
    });

    render(<SubtitleBurnNode {...createNodeProps({ srtText: "hand-edited", srtSource: "manual" })} />);

    expect(mockUpdateNodeData).not.toHaveBeenCalledWith(
      "test-subburn-1",
      expect.objectContaining({ srtText: "new connected srt" })
    );
  });

  it("enables Burn only when both a video and non-empty SRT are present", () => {
    render(<SubtitleBurnNode {...createNodeProps()} />);
    expect(screen.getByRole("button", { name: "Burn Subtitles" })).not.toBeDisabled();
  });

  it("disables Burn when SRT text is empty", () => {
    render(<SubtitleBurnNode {...createNodeProps({ srtText: "" })} />);
    expect(screen.getByRole("button", { name: "Burn Subtitles" })).toBeDisabled();
  });

  it("writes style preset and position changes", () => {
    render(<SubtitleBurnNode {...createNodeProps()} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "bold" } });
    expect(mockUpdateNodeData).toHaveBeenCalledWith("test-subburn-1", { stylePreset: "bold" });

    fireEvent.click(screen.getByTitle("Top"));
    expect(mockUpdateNodeData).toHaveBeenCalledWith("test-subburn-1", { position: "top" });
  });

  it("calls regenerateNode when Burn is clicked", () => {
    render(<SubtitleBurnNode {...createNodeProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Burn Subtitles" }));
    expect(mockRegenerateNode).toHaveBeenCalledWith("test-subburn-1");
  });
});
