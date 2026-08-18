import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeSubtitleBurn } from "../subtitleBurnExecutor";
import type { NodeExecutionContext } from "../types";
import type { WorkflowNode, ProviderSettings } from "@/types";
import { burnSubtitlesAsync } from "@/hooks/useBurnSubtitles";

vi.mock("@/hooks/useBurnSubtitles", () => ({
  burnSubtitlesAsync: vi.fn(),
}));
const mockBurnSubtitlesAsync = burnSubtitlesAsync as unknown as ReturnType<typeof vi.fn>;

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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

function makeNode(data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id: "sb-1",
    type: "subtitleBurn",
    position: { x: 0, y: 0 },
    data: {
      srtText: "1\n00:00:00,000 --> 00:00:01,000\nHi",
      srtSource: "manual",
      stylePreset: "default",
      position: "bottom",
      outputVideo: null,
      status: "idle",
      error: null,
      progress: 0,
      encoderSupported: true,
      ...data,
    },
  } as WorkflowNode;
}

function makeCtx(
  node: WorkflowNode,
  overrides: Partial<NodeExecutionContext> = {}
): NodeExecutionContext {
  return {
    node,
    getConnectedInputs: vi.fn().mockReturnValue({
      images: [],
      videos: ["video-url"],
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
  mockFetch.mockReset();
  mockBurnSubtitlesAsync.mockReset();
});

describe("executeSubtitleBurn", () => {
  it("errors when encoder is not supported", async () => {
    const node = makeNode({ encoderSupported: false });
    const ctx = makeCtx(node);

    await expect(executeSubtitleBurn(ctx)).rejects.toThrow(
      "Browser does not support video encoding"
    );
    expect(ctx.updateNodeData).toHaveBeenCalledWith(
      "sb-1",
      expect.objectContaining({ status: "error", error: "Browser does not support video encoding" })
    );
  });

  it("errors when no video is connected", async () => {
    const node = makeNode();
    const ctx = makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: [],
        audio: [],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });

    await expect(executeSubtitleBurn(ctx)).rejects.toThrow(
      "Connect a video input to burn subtitles"
    );
  });

  it("errors when SRT text is empty", async () => {
    const node = makeNode({ srtText: "   " });
    const ctx = makeCtx(node);

    await expect(executeSubtitleBurn(ctx)).rejects.toThrow(
      "No SRT text to burn"
    );
  });

  it("passes SRT, style preset, and position through to the burn helper", async () => {
    const node = makeNode({
      srtText: "1\n00:00:00,000 --> 00:00:01,000\nStyled",
      stylePreset: "bold",
      position: "top",
    });
    const ctx = makeCtx(node);

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["v"], { type: "video/mp4" })),
    });
    mockBurnSubtitlesAsync.mockResolvedValue({
      size: 21 * 1024 * 1024,
      type: "video/mp4",
    } as Blob);

    await executeSubtitleBurn(ctx);

    expect(mockBurnSubtitlesAsync).toHaveBeenCalledWith(
      expect.any(Blob),
      "1\n00:00:00,000 --> 00:00:01,000\nStyled",
      "bold",
      "top",
      expect.any(Function),
      undefined
    );
    expect(ctx.updateNodeData).toHaveBeenCalledWith(
      "sb-1",
      expect.objectContaining({ status: "complete", progress: 100 })
    );
  });

  it("threads ctx.signal into the burn helper", async () => {
    const node = makeNode();
    const controller = new AbortController();
    const ctx = makeCtx(node, { signal: controller.signal });

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["v"], { type: "video/mp4" })),
    });
    mockBurnSubtitlesAsync.mockResolvedValue({
      size: 21 * 1024 * 1024,
      type: "video/mp4",
    } as Blob);

    await executeSubtitleBurn(ctx);

    expect(mockBurnSubtitlesAsync.mock.calls[0][5]).toBe(controller.signal);
  });

  it("treats an AbortError from the helper as idle cancellation", async () => {
    const node = makeNode();
    const ctx = makeCtx(node);

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["v"], { type: "video/mp4" })),
    });
    mockBurnSubtitlesAsync.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    await expect(executeSubtitleBurn(ctx)).rejects.toMatchObject({ name: "AbortError" });

    const calls = (ctx.updateNodeData as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => (c[1] as Record<string, unknown>).status === "idle")).toBe(true);
    expect(calls.some((c) => (c[1] as Record<string, unknown>).status === "error")).toBe(false);
  });
});
