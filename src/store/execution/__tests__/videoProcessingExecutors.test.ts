import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeVideoStitch, executeEaseCurve, executeVideoTrim } from "../videoProcessingExecutors";
import type { NodeExecutionContext } from "../types";
import type { WorkflowNode, ProviderSettings } from "@/types";
import { stitchVideosAsync } from "@/hooks/useStitchVideos";
import { trimVideoAsync, trimVideoRemoveSilenceAsync } from "@/hooks/useTrimVideo";

// Mock the stitch helper so the executor's cancellation wiring can be asserted
// without running the real mediabunny encode.
vi.mock("@/hooks/useStitchVideos", () => ({
  stitchVideosAsync: vi.fn(),
  checkEncoderSupport: vi.fn().mockResolvedValue(true),
}));
const mockStitchVideosAsync = stitchVideosAsync as unknown as ReturnType<typeof vi.fn>;

// Mock the trim helpers (manual trim + silence-removal variants).
vi.mock("@/hooks/useTrimVideo", () => ({
  trimVideoAsync: vi.fn(),
  trimVideoRemoveSilenceAsync: vi.fn(),
}));
const mockTrimVideoAsync = trimVideoAsync as unknown as ReturnType<typeof vi.fn>;
const mockTrimVideoRemoveSilenceAsync = trimVideoRemoveSilenceAsync as unknown as ReturnType<typeof vi.fn>;

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock URL methods
vi.stubGlobal("URL", {
  ...URL,
  createObjectURL: vi.fn().mockReturnValue("blob:http://localhost/mock"),
  revokeObjectURL: vi.fn(),
});

const defaultProviderSettings = {
  providers: {
    gemini: { apiKey: "" },
    replicate: { apiKey: "" },
    fal: { apiKey: "" },
    kie: { apiKey: "" },
    wavespeed: { apiKey: "" },
    openai: { apiKey: "" },
  },
} as unknown as ProviderSettings;

function makeCtx(
  node: WorkflowNode,
  overrides: Partial<NodeExecutionContext> = {}
): NodeExecutionContext {
  return {
    node,
    getConnectedInputs: vi.fn().mockReturnValue({
      images: [],
      videos: [],
      audio: [],
      text: null,
      dynamicInputs: {},
      easeCurve: null,
    }),
    updateNodeData: vi.fn(),
    getFreshNode: vi.fn().mockReturnValue(node),
    getEdges: vi.fn().mockReturnValue([]),
    getNodes: vi.fn().mockReturnValue([node]),
    providerSettings: defaultProviderSettings,
    addIncurredCost: vi.fn(),
    addToGlobalHistory: vi.fn(),
    generationsPath: null,
    saveDirectoryPath: null,
    trackSaveGeneration: vi.fn(),
    appendOutputGalleryImage: vi.fn(),
    appendOutputGalleryVideo: vi.fn(),
    materializeSplitGridCells: vi.fn().mockReturnValue(false),
    get: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks resets call history but NOT implementations, so explicitly
  // drop any per-test fetch/helper impl to avoid leaking across tests (a
  // resolving fetch would make video-metadata probing hang other cases).
  mockFetch.mockReset();
  mockStitchVideosAsync.mockReset();
  mockTrimVideoAsync.mockReset();
  mockTrimVideoRemoveSilenceAsync.mockReset();
});

describe("executeVideoStitch", () => {
  function makeStitchNode(data: Record<string, unknown> = {}): WorkflowNode {
    return {
      id: "vs-1",
      type: "videoStitch",
      position: { x: 0, y: 0 },
      data: {
        outputVideo: null,
        status: null,
        error: null,
        progress: 0,
        encoderSupported: true,
        loopCount: 1,
        ...data,
      },
    } as WorkflowNode;
  }

  it("should error when encoder not supported", async () => {
    const node = makeStitchNode({ encoderSupported: false });
    const ctx = makeCtx(node);

    await expect(executeVideoStitch(ctx)).rejects.toThrow("Browser does not support video encoding");

    expect(ctx.updateNodeData).toHaveBeenCalledWith("vs-1", expect.objectContaining({
      status: "error",
      error: "Browser does not support video encoding",
    }));
  });

  it("should error when fewer than 2 videos", async () => {
    const node = makeStitchNode();
    const ctx = makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: ["single-video"],
        audio: [],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });

    await expect(executeVideoStitch(ctx)).rejects.toThrow("Need at least 2 video clips to stitch");

    expect(ctx.updateNodeData).toHaveBeenCalledWith("vs-1", expect.objectContaining({
      status: "error",
      error: "Need at least 2 video clips to stitch",
    }));
  });

  it("should set loading status with 0 progress", async () => {
    const node = makeStitchNode();
    const ctx = makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: ["video1", "video2"],
        audio: [],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });

    // Will fail at fetch but we only care about the loading call
    await executeVideoStitch(ctx).catch(() => {});

    const calls = (ctx.updateNodeData as ReturnType<typeof vi.fn>).mock.calls;
    const loadingCall = calls.find(
      (c: unknown[]) =>
        (c[1] as Record<string, unknown>).status === "loading" &&
        (c[1] as Record<string, unknown>).progress === 0
    );
    expect(loadingCall).toBeDefined();
  });
});

describe("executeVideoStitch — transitions & color grading", () => {
  function makeStitchNode(data: Record<string, unknown> = {}): WorkflowNode {
    return {
      id: "vs-1",
      type: "videoStitch",
      position: { x: 0, y: 0 },
      data: {
        outputVideo: null,
        status: null,
        error: null,
        progress: 0,
        encoderSupported: true,
        loopCount: 1,
        clipOrder: [],
        transitions: [],
        colorGrading: {},
        ...data,
      },
    } as WorkflowNode;
  }

  function makeEdgeCtx(
    node: WorkflowNode,
    edges: Array<{ id: string; source: string; targetHandle: string }>,
    nodes: WorkflowNode[],
    signal?: AbortSignal
  ): NodeExecutionContext {
    return makeCtx(node, {
      signal,
      getEdges: vi.fn().mockReturnValue(
        edges.map((e) => ({ id: e.id, source: e.source, target: "vs-1", targetHandle: e.targetHandle }))
      ),
      getNodes: vi.fn().mockReturnValue(nodes),
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: ["fallback-a", "fallback-b"],
        audio: [],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });
  }

  const srcNode = (id: string, video: string): WorkflowNode =>
    ({
      id,
      type: "videoInput",
      position: { x: 0, y: 0 },
      data: { video },
    }) as WorkflowNode;

  beforeEach(() => {
    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["v"], { type: "video/mp4" })),
    });
    mockStitchVideosAsync.mockResolvedValue({ size: 21 * 1024 * 1024, type: "video/mp4" } as Blob);
  });

  it("passes undefined effect arrays when no transitions or grading are configured", async () => {
    const node = makeStitchNode();
    const edges = [
      { id: "edge-a", source: "n-a", targetHandle: "video-0" },
      { id: "edge-b", source: "n-b", targetHandle: "video-1" },
    ];
    const ctx = makeEdgeCtx(node, edges, [node, srcNode("n-a", "url-a"), srcNode("n-b", "url-b")]);

    await executeVideoStitch(ctx);

    expect(mockStitchVideosAsync).toHaveBeenCalled();
    expect(mockStitchVideosAsync.mock.calls[0][4]).toBeUndefined();
    expect(mockStitchVideosAsync.mock.calls[0][5]).toBeUndefined();
  });

  it("orders blobs by clipOrder and maps transitions/colorGrading by edgeId", async () => {
    const node = makeStitchNode({
      clipOrder: ["edge-b", "edge-a"],
      transitions: [{ afterClipEdgeId: "edge-b", type: "crossfade", durationSec: 1 }],
      colorGrading: { "edge-a": { temperature: 50, tint: 0 } },
    });
    const edges = [
      { id: "edge-a", source: "n-a", targetHandle: "video-0" },
      { id: "edge-b", source: "n-b", targetHandle: "video-1" },
    ];
    const ctx = makeEdgeCtx(node, edges, [node, srcNode("n-a", "url-a"), srcNode("n-b", "url-b")]);

    await executeVideoStitch(ctx);

    // Fetches happen in clipOrder (edge-b first).
    expect(mockFetch.mock.calls[0][0]).toBe("url-b");
    expect(mockFetch.mock.calls[1][0]).toBe("url-a");

    // Grading follows the edge order: edge-b has none, edge-a has temperature 50.
    const gradingArg = mockStitchVideosAsync.mock.calls[0][4];
    expect(gradingArg).toEqual([undefined, { temperature: 50, tint: 0 }]);

    // Transition keyed on edge-b lands at index 0 (the clip edge-b precedes edge-a).
    const transitionsArg = mockStitchVideosAsync.mock.calls[0][5];
    expect(transitionsArg).toEqual([
      { afterClipEdgeId: "edge-b", type: "crossfade", durationSec: 1 },
      undefined,
    ]);
  });

  it("repeats effects per loop iteration but hard-cuts between loop repeats", async () => {
    const node = makeStitchNode({
      loopCount: 2,
      clipOrder: ["edge-a", "edge-b"],
      transitions: [{ afterClipEdgeId: "edge-a", type: "crossfade", durationSec: 1 }],
      colorGrading: { "edge-a": { temperature: 25, tint: 0 } },
    });
    const edges = [
      { id: "edge-a", source: "n-a", targetHandle: "video-0" },
      { id: "edge-b", source: "n-b", targetHandle: "video-1" },
    ];
    const ctx = makeEdgeCtx(node, edges, [node, srcNode("n-a", "url-a"), srcNode("n-b", "url-b")]);

    await executeVideoStitch(ctx);

    // 2 clips x 2 loops = 4 blobs; grading repeated per loop.
    const blobs = mockStitchVideosAsync.mock.calls[0][0];
    expect(blobs).toHaveLength(4);
    const gradingArg = mockStitchVideosAsync.mock.calls[0][4];
    expect(gradingArg).toEqual([
      { temperature: 25, tint: 0 },
      undefined,
      { temperature: 25, tint: 0 },
      undefined,
    ]);
    // The transition entry after edge-a repeats; the final slot (end of each
    // loop pass) stays undefined so loop seams are hard cuts.
    const transitionsArg = mockStitchVideosAsync.mock.calls[0][5];
    expect(transitionsArg).toEqual([
      { afterClipEdgeId: "edge-a", type: "crossfade", durationSec: 1 },
      undefined,
      { afterClipEdgeId: "edge-a", type: "crossfade", durationSec: 1 },
      undefined,
    ]);
  });

  it("falls back to getConnectedInputs ordering when edge resolution finds fewer than 2 videos", async () => {
    const node = makeStitchNode({
      colorGrading: { "edge-x": { temperature: 10, tint: 0 } },
    });
    // No video-* edges resolve -> falls back to the fallback-a/fallback-b list.
    const ctx = makeEdgeCtx(node, [], [node]);

    await executeVideoStitch(ctx);

    expect(mockFetch.mock.calls[0][0]).toBe("fallback-a");
    expect(mockStitchVideosAsync.mock.calls[0][4]).toBeUndefined();
    expect(mockStitchVideosAsync.mock.calls[0][5]).toBeUndefined();
  });
});

describe("executeVideoStitch — cancellation", () => {
  function makeStitchNode(): WorkflowNode {
    return {
      id: "vs-1",
      type: "videoStitch",
      position: { x: 0, y: 0 },
      data: {
        outputVideo: null,
        status: null,
        error: null,
        progress: 0,
        encoderSupported: true,
        loopCount: 1,
      },
    } as WorkflowNode;
  }

  function makeTwoVideoCtx(node: WorkflowNode, signal?: AbortSignal) {
    return makeCtx(node, {
      signal,
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: ["v1", "v2"],
        audio: [],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });
  }

  it("threads ctx.signal into stitchVideosAsync", async () => {
    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["v"], { type: "video/mp4" })),
    });
    // Large output routes through URL.createObjectURL (mocked), avoiding FileReader.
    mockStitchVideosAsync.mockResolvedValue({ size: 21 * 1024 * 1024, type: "video/mp4" } as Blob);
    const controller = new AbortController();
    const ctx = makeTwoVideoCtx(makeStitchNode(), controller.signal);

    await executeVideoStitch(ctx);

    expect(mockStitchVideosAsync).toHaveBeenCalled();
    // signal is the 4th positional argument
    expect(mockStitchVideosAsync.mock.calls[0][3]).toBe(controller.signal);
  });

  it("treats an AbortError from the helper as idle cancellation, not an error", async () => {
    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["v"], { type: "video/mp4" })),
    });
    mockStitchVideosAsync.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const ctx = makeTwoVideoCtx(makeStitchNode());

    await expect(executeVideoStitch(ctx)).rejects.toMatchObject({ name: "AbortError" });

    const calls = (ctx.updateNodeData as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => (c[1] as Record<string, unknown>).status === "idle")).toBe(true);
    expect(calls.some((c) => (c[1] as Record<string, unknown>).status === "error")).toBe(false);
  });
});

describe("executeEaseCurve", () => {
  function makeEaseNode(data: Record<string, unknown> = {}): WorkflowNode {
    return {
      id: "ec-1",
      type: "easeCurve",
      position: { x: 0, y: 0 },
      data: {
        outputVideo: null,
        status: null,
        error: null,
        progress: 0,
        encoderSupported: true,
        bezierHandles: [0.25, 0.1, 0.25, 1.0],
        easingPreset: "ease-in-out",
        outputDuration: 5,
        ...data,
      },
    } as WorkflowNode;
  }

  it("should error when encoder not supported", async () => {
    const node = makeEaseNode({ encoderSupported: false });
    const ctx = makeCtx(node);

    await expect(executeEaseCurve(ctx)).rejects.toThrow("Browser does not support video encoding");

    expect(ctx.updateNodeData).toHaveBeenCalledWith("ec-1", expect.objectContaining({
      status: "error",
      error: "Browser does not support video encoding",
    }));
  });

  it("should error when no video connected", async () => {
    const node = makeEaseNode();
    const ctx = makeCtx(node);

    await expect(executeEaseCurve(ctx)).rejects.toThrow("Connect a video input to apply ease curve");

    expect(ctx.updateNodeData).toHaveBeenCalledWith("ec-1", expect.objectContaining({
      status: "error",
      error: "Connect a video input to apply ease curve",
    }));
  });

  it("should set loading status with 0 progress", async () => {
    const node = makeEaseNode();
    const ctx = makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: ["video1"],
        audio: [],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });

    // Will fail at fetch but we only care about the loading call
    await executeEaseCurve(ctx).catch(() => {});

    const calls = (ctx.updateNodeData as ReturnType<typeof vi.fn>).mock.calls;
    const loadingCall = calls.find(
      (c: unknown[]) =>
        (c[1] as Record<string, unknown>).status === "loading" &&
        (c[1] as Record<string, unknown>).progress === 0
    );
    expect(loadingCall).toBeDefined();
  });

  it("should propagate parent easeCurve settings", async () => {
    const node = makeEaseNode({
      bezierHandles: [0, 0, 1, 1],
      easingPreset: null,
    });
    const ctx = makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: ["video1"],
        audio: [],
        text: null,
        dynamicInputs: {},
        easeCurve: {
          bezierHandles: [0.42, 0, 0.58, 1],
          easingPreset: "ease-in-out",
          outputDuration: 10,
        },
      }),
      getEdges: vi.fn().mockReturnValue([
        { id: "e1", source: "parent-ec", target: "ec-1", targetHandle: "easeCurve" },
      ]),
    });

    // Will fail at fetch but we only care about the easeCurve propagation
    await executeEaseCurve(ctx).catch(() => {});

    expect(ctx.updateNodeData).toHaveBeenCalledWith("ec-1", expect.objectContaining({
      bezierHandles: [0.42, 0, 0.58, 1],
      easingPreset: "ease-in-out",
      outputDuration: 10,
      inheritedFrom: "parent-ec",
    }));
  });
});

describe("executeVideoTrim", () => {
  function makeTrimNode(data: Record<string, unknown> = {}): WorkflowNode {
    return {
      id: "vt-1",
      type: "videoTrim",
      position: { x: 0, y: 0 },
      data: {
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
        ...data,
      },
    } as WorkflowNode;
  }

  function makeTrimCtx(node: WorkflowNode): NodeExecutionContext {
    return makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: ["video-url"],
        audio: [],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });
  }

  it("errors when no video is connected", async () => {
    const node = makeTrimNode();
    const ctx = makeCtx(node);

    await expect(executeVideoTrim(ctx)).rejects.toThrow("Connect a video input to trim");
  });

  it("manual mode calls trimVideoAsync with start/end times", async () => {
    const node = makeTrimNode({ startTime: 2, endTime: 8 });
    const ctx = makeTrimCtx(node);

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["v"], { type: "video/mp4" })),
    });
    mockTrimVideoAsync.mockResolvedValue({ size: 21 * 1024 * 1024, type: "video/mp4" } as Blob);

    await executeVideoTrim(ctx);

    expect(mockTrimVideoAsync).toHaveBeenCalledWith(
      expect.any(Blob),
      2,
      8,
      expect.any(Function),
      undefined
    );
    expect(mockTrimVideoRemoveSilenceAsync).not.toHaveBeenCalled();
  });

  it("removeSilence mode calls trimVideoRemoveSilenceAsync with detection params and stores removed duration", async () => {
    const node = makeTrimNode({
      mode: "removeSilence",
      silenceThresholdDb: -35,
      minSilenceDuration: 0.4,
      paddingDuration: 0.15,
    });
    const ctx = makeTrimCtx(node);

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["v"], { type: "video/mp4" })),
    });
    mockTrimVideoRemoveSilenceAsync.mockResolvedValue({
      blob: { size: 21 * 1024 * 1024, type: "video/mp4" } as Blob,
      removedDuration: 3.2,
    });

    await executeVideoTrim(ctx);

    expect(mockTrimVideoRemoveSilenceAsync).toHaveBeenCalledWith(
      expect.any(Blob),
      { thresholdDb: -35, minSilenceDuration: 0.4, paddingDuration: 0.15 },
      expect.any(Function),
      undefined
    );
    expect(mockTrimVideoAsync).not.toHaveBeenCalled();
    expect(ctx.updateNodeData).toHaveBeenCalledWith(
      "vt-1",
      expect.objectContaining({
        status: "complete",
        removedSilenceDuration: 3.2,
      })
    );
  });

  it("manual mode preserves a previously recorded removedSilenceDuration", async () => {
    const node = makeTrimNode({ removedSilenceDuration: 5 });
    const ctx = makeTrimCtx(node);

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["v"], { type: "video/mp4" })),
    });
    mockTrimVideoAsync.mockResolvedValue({ size: 21 * 1024 * 1024, type: "video/mp4" } as Blob);

    await executeVideoTrim(ctx);

    expect(ctx.updateNodeData).toHaveBeenCalledWith(
      "vt-1",
      expect.objectContaining({ removedSilenceDuration: 5 })
    );
  });
});
