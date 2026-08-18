import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeTranscribe } from "../transcribeExecutor";
import type { NodeExecutionContext } from "../types";
import type { WorkflowNode, ProviderSettings } from "@/types";

const mockExtractAudioAsync = vi.fn();
vi.mock("@/hooks/useExtractAudio", () => ({
  extractAudioAsync: (...args: unknown[]) => mockExtractAudioAsync(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const defaultProviderSettings = {
  providers: {
    gemini: { apiKey: "" },
    replicate: { apiKey: "" },
    fal: { apiKey: "" },
    kie: { apiKey: "" },
    wavespeed: { apiKey: "" },
    openai: { apiKey: "sk-test" },
  },
} as unknown as ProviderSettings;

function makeNode(data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id: "transcribe-1",
    type: "transcribe",
    position: { x: 0, y: 0 },
    data: {
      language: "auto",
      outputSrt: null,
      status: "idle",
      error: null,
      progress: 0,
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
  mockFetch.mockReset();
  mockExtractAudioAsync.mockReset();
});

describe("executeTranscribe", () => {
  it("errors when no video or audio is connected", async () => {
    const node = makeNode();
    const ctx = makeCtx(node);

    await expect(executeTranscribe(ctx)).rejects.toThrow(
      "Connect a video or audio input to transcribe"
    );
    expect(ctx.updateNodeData).toHaveBeenCalledWith(
      "transcribe-1",
      expect.objectContaining({ status: "error", error: "Connect a video or audio input to transcribe" })
    );
  });

  it("extracts audio from a connected video before transcribing", async () => {
    const node = makeNode();
    const ctx = makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: ["video-url"],
        audio: [],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });

    const videoBlob = new Blob(["v"], { type: "video/mp4" });
    const audioBlob = new Blob(["a"], { type: "audio/wav" });
    mockFetch
      .mockResolvedValueOnce({ blob: () => Promise.resolve(videoBlob) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, srt: "1\n00:00:00,000 --> 00:00:01,000\nHi" }),
      });
    mockExtractAudioAsync.mockResolvedValue(audioBlob);

    await executeTranscribe(ctx);

    expect(mockExtractAudioAsync).toHaveBeenCalledWith(videoBlob);
    expect(ctx.updateNodeData).toHaveBeenCalledWith(
      "transcribe-1",
      expect.objectContaining({
        status: "complete",
        outputSrt: "1\n00:00:00,000 --> 00:00:01,000\nHi",
      })
    );
  });

  it("errors when the connected video has no audio track", async () => {
    const node = makeNode();
    const ctx = makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: ["video-url"],
        audio: [],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });
    mockFetch.mockResolvedValue({ blob: () => Promise.resolve(new Blob(["v"])) });
    mockExtractAudioAsync.mockResolvedValue(null);

    await expect(executeTranscribe(ctx)).rejects.toThrow(
      "No audio track found in the connected video"
    );
  });

  it("transcribes a connected audio input directly, without extraction", async () => {
    const node = makeNode();
    const ctx = makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: [],
        audio: ["audio-url"],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });
    mockFetch
      .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob(["a"], { type: "audio/wav" })) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, srt: "1\n00:00:00,000 --> 00:00:01,000\nAudio" }),
      });

    await executeTranscribe(ctx);

    expect(mockExtractAudioAsync).not.toHaveBeenCalled();
    expect(ctx.updateNodeData).toHaveBeenCalledWith(
      "transcribe-1",
      expect.objectContaining({ status: "complete" })
    );
  });

  it("passes the OpenAI API key header when configured", async () => {
    const node = makeNode();
    const ctx = makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: [],
        audio: ["audio-url"],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });
    mockFetch
      .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob(["a"])) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, srt: "srt" }) });

    await executeTranscribe(ctx);

    const transcribeCall = mockFetch.mock.calls.find((c) => c[0] === "/api/transcribe");
    expect(transcribeCall?.[1].headers).toEqual({ "X-OpenAI-API-Key": "sk-test" });
  });

  it("surfaces an API error response", async () => {
    const node = makeNode();
    const ctx = makeCtx(node, {
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: [],
        audio: ["audio-url"],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });
    mockFetch
      .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob(["a"])) })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "OpenAI API key required." }),
      });

    await expect(executeTranscribe(ctx)).rejects.toThrow("OpenAI API key required.");
    expect(ctx.updateNodeData).toHaveBeenCalledWith(
      "transcribe-1",
      expect.objectContaining({ status: "error", error: "OpenAI API key required." })
    );
  });

  it("treats an AbortError as idle cancellation, not an error", async () => {
    const node = makeNode();
    const controller = new AbortController();
    const ctx = makeCtx(node, {
      signal: controller.signal,
      getConnectedInputs: vi.fn().mockReturnValue({
        images: [],
        videos: [],
        audio: ["audio-url"],
        text: null,
        dynamicInputs: {},
        easeCurve: null,
      }),
    });
    mockFetch.mockImplementation(() => {
      controller.abort();
      return Promise.resolve({ blob: () => Promise.resolve(new Blob(["a"])) });
    });

    await expect(executeTranscribe(ctx)).rejects.toMatchObject({ name: "AbortError" });

    const calls = (ctx.updateNodeData as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => (c[1] as Record<string, unknown>).status === "idle")).toBe(true);
    expect(calls.some((c) => (c[1] as Record<string, unknown>).status === "error")).toBe(false);
  });
});
