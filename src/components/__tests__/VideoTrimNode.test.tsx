import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoTrimNodeData } from "@/types";

// Mock the workflow store
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

// Mock @xyflow/react
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

// Mock checkEncoderSupport
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

import { VideoTrimNode } from "@/components/nodes/VideoTrimNode";

function setMockStoreState(overrides: Record<string, unknown> = {}) {
  const state = {
    updateNodeData: mockUpdateNodeData,
    regenerateNode: mockRegenerateNode,
    removeEdge: vi.fn(),
    edges: [
      { id: "e1", source: "gen1", target: "test-trim-1", targetHandle: "video" },
    ],
    nodes: [
      { id: "gen1", type: "generateVideo", data: { outputVideo: "blob:video1" } },
    ],
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

const createNodeData = (overrides: Partial<VideoTrimNodeData> = {}): VideoTrimNodeData => ({
  mode: "manual",
  startTime: 0,
  endTime: 10,
  duration: 10,
  silenceThresholdDb: -40,
  minSilenceDuration: 0.5,
  paddingDuration: 0.1,
  removedSilenceDuration: null,
  outputVideo: null,
  status: "idle",
  error: null,
  progress: 0,
  encoderSupported: true,
  ...overrides,
});

const createNodeProps = (data: Partial<VideoTrimNodeData> = {}) => ({
  id: "test-trim-1",
  type: "videoTrim" as const,
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

describe("VideoTrimNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckEncoderSupport.mockResolvedValue(true);
    setMockStoreState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Mode Toggle", () => {
    it("defaults to manual mode showing the trim range slider", () => {
      const { container } = render(<VideoTrimNode {...createNodeProps()} />);
      expect(container.querySelector(".trim-slider-container")).toBeInTheDocument();
      // Mode toggle + action button both render "Trim" — the mode toggle comes first in DOM order.
      expect(screen.getAllByText("Trim").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("Remove Silence")).toBeInTheDocument();
    });

    it("switching to Remove Silence hides the trim slider and shows silence controls", () => {
      render(<VideoTrimNode {...createNodeProps({ mode: "removeSilence" })} />);

      expect(document.querySelector(".trim-slider-container")).not.toBeInTheDocument();
      expect(screen.getByText("Threshold")).toBeInTheDocument();
      expect(screen.getByText("Min silence")).toBeInTheDocument();
      expect(screen.getByText("Padding")).toBeInTheDocument();
    });

    it("clicking the mode buttons calls updateNodeData with the new mode", () => {
      render(<VideoTrimNode {...createNodeProps()} />);

      fireEvent.click(screen.getByText("Remove Silence"));
      expect(mockUpdateNodeData).toHaveBeenCalledWith("test-trim-1", { mode: "removeSilence" });

      fireEvent.click(screen.getAllByText("Trim")[0]);
      expect(mockUpdateNodeData).toHaveBeenCalledWith("test-trim-1", { mode: "manual" });
    });
  });

  describe("Silence Controls", () => {
    it("updating the threshold slider writes silenceThresholdDb", () => {
      render(<VideoTrimNode {...createNodeProps({ mode: "removeSilence" })} />);

      const sliders = document.querySelectorAll('input[type="range"]');
      expect(sliders.length).toBe(3);

      fireEvent.change(sliders[0], { target: { value: "-35" } });
      expect(mockUpdateNodeData).toHaveBeenCalledWith("test-trim-1", { silenceThresholdDb: -35 });
    });

    it("shows the removed-silence summary after a removeSilence run", () => {
      render(
        <VideoTrimNode {...createNodeProps({ mode: "removeSilence", removedSilenceDuration: 3.2 })} />
      );
      expect(screen.getByText("Removed 3.2s of silence")).toBeInTheDocument();
    });

    it("hides the summary in manual mode even when a removed duration was recorded", () => {
      render(
        <VideoTrimNode {...createNodeProps({ mode: "manual", removedSilenceDuration: 3.2 })} />
      );
      expect(screen.queryByText(/Removed .* of silence/)).not.toBeInTheDocument();
    });
  });

  describe("Action Button", () => {
    it("manual mode still requires a valid range to enable", () => {
      const { container } = render(<VideoTrimNode {...createNodeProps({ startTime: 5, endTime: 5 })} />);
      const actionButton = container.querySelector(".shrink-0.flex.justify-end.px-1 button") as HTMLButtonElement;
      expect(actionButton).toBeDisabled();
    });

    it("removeSilence mode enables the button with just a source video", () => {
      const { container } = render(<VideoTrimNode {...createNodeProps({ mode: "removeSilence", startTime: 5, endTime: 5 })} />);
      const actionButton = container.querySelector(".shrink-0.flex.justify-end.px-1 button") as HTMLButtonElement;
      expect(actionButton).not.toBeDisabled();
    });
  });
});
