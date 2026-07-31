import { describe, it, expect, vi, beforeEach } from "vitest";

// This repo's jsdom environment replaces localStorage with a bare object
// (same root cause as the pre-existing store test load failures), so install
// a working stub for these tests.
const backingStore = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => backingStore.get(key) ?? null,
    setItem: (key: string, value: string) => void backingStore.set(key, String(value)),
    removeItem: (key: string) => void backingStore.delete(key),
    clear: () => backingStore.clear(),
  },
});

// Minimal workflowStore mock shared by presets + versionHistory
let mockState: {
  nodes: unknown[];
  edges: unknown[];
  clipboard: unknown;
  pasteNodes: ReturnType<typeof vi.fn>;
};

vi.mock("@/store/workflowStore", () => {
  const useWorkflowStore = (selector?: (s: unknown) => unknown) =>
    selector ? selector(mockState) : mockState;
  useWorkflowStore.getState = () => mockState;
  useWorkflowStore.setState = (partial: Record<string, unknown>) => {
    mockState = { ...mockState, ...partial };
  };
  return { useWorkflowStore };
});

import {
  loadPresets,
  savePresetFromSelection,
  deletePreset,
  applyPreset,
} from "@/utils/presets";
import {
  loadHistory,
  captureSnapshotNow,
  deleteSnapshot,
  restoreSnapshot,
  MAX_SNAPSHOTS,
} from "@/utils/versionHistory";

const makeNode = (id: string, selected = false, data: Record<string, unknown> = {}) => ({
  id,
  type: "prompt",
  position: { x: 0, y: 0 },
  selected,
  data: { prompt: "hello", ...data },
});

beforeEach(() => {
  localStorage.clear();
  mockState = { nodes: [], edges: [], clipboard: null, pasteNodes: vi.fn() };
});

describe("presets", () => {
  it("returns empty list when nothing stored", () => {
    expect(loadPresets()).toEqual([]);
  });

  it("saves selected nodes and interconnecting edges only", () => {
    mockState.nodes = [makeNode("a", true), makeNode("b", true), makeNode("c", false)];
    mockState.edges = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
    ];
    const preset = savePresetFromSelection("My preset");
    expect(preset).not.toBeNull();
    expect(preset!.version).toBe(1);
    expect(preset!.nodes.map((n: { id: string }) => n.id).sort()).toEqual(["a", "b"]);
    expect(preset!.edges.map((e: { id: string }) => e.id)).toEqual(["e1"]);
    expect(loadPresets()).toHaveLength(1);
  });

  it("returns null when nothing is selected", () => {
    mockState.nodes = [makeNode("a", false)];
    expect(savePresetFromSelection("x")).toBeNull();
  });

  it("uses a fallback name for blank input", () => {
    mockState.nodes = [makeNode("a", true)];
    expect(savePresetFromSelection("  ")!.name).toBe("Untitled preset");
  });

  it("deletes a preset by id", () => {
    mockState.nodes = [makeNode("a", true)];
    const preset = savePresetFromSelection("p")!;
    deletePreset(preset.id);
    expect(loadPresets()).toEqual([]);
  });

  it("applyPreset routes through clipboard + pasteNodes", () => {
    mockState.nodes = [makeNode("a", true)];
    const preset = savePresetFromSelection("p")!;
    applyPreset(preset);
    expect(mockState.clipboard).toMatchObject({ nodes: preset.nodes, edges: preset.edges });
    expect(mockState.pasteNodes).toHaveBeenCalledWith({ x: 40, y: 40 });
  });

  it("ignores corrupt localStorage data", () => {
    localStorage.setItem("node-banana-presets", "{not json");
    expect(loadPresets()).toEqual([]);
    localStorage.setItem("node-banana-presets", JSON.stringify([{ bad: true }]));
    expect(loadPresets()).toEqual([]);
  });
});

describe("versionHistory", () => {
  it("captures snapshots newest-first and caps at MAX_SNAPSHOTS", () => {
    mockState.nodes = [makeNode("a")];
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) {
      captureSnapshotNow();
    }
    const history = loadHistory();
    expect(history).toHaveLength(MAX_SNAPSHOTS);
    expect(history[0].nodeCount).toBe(1);
  });

  it("returns null for an empty canvas", () => {
    mockState.nodes = [];
    expect(captureSnapshotNow()).toBeNull();
  });

  it("strips inline base64 media but keeps refs and text", () => {
    mockState.nodes = [
      makeNode("a", false, {
        image: "data:image/png;base64,AAAA",
        imageRef: "refs/img1.png",
        prompt: "keep me",
      }),
    ];
    captureSnapshotNow();
    const snap = loadHistory()[0];
    const data = snap.nodes[0].data as Record<string, unknown>;
    expect(data.image).toBeNull();
    expect(data.imageRef).toBe("refs/img1.png");
    expect(data.prompt).toBe("keep me");
  });

  it("restores a snapshot into the store", () => {
    mockState.nodes = [makeNode("a")];
    mockState.edges = [{ id: "e1", source: "a", target: "b" }];
    const snap = captureSnapshotNow()!;
    mockState.nodes = [];
    mockState.edges = [];
    expect(restoreSnapshot(snap.id)).toBe(true);
    expect(mockState.nodes).toHaveLength(1);
    expect(mockState.edges).toHaveLength(1);
    expect((mockState as Record<string, unknown>).hasUnsavedChanges).toBe(true);
  });

  it("restoreSnapshot returns false for unknown id", () => {
    expect(restoreSnapshot("nope")).toBe(false);
  });

  it("deletes snapshots by id", () => {
    mockState.nodes = [makeNode("a")];
    const snap = captureSnapshotNow()!;
    deleteSnapshot(snap.id);
    expect(loadHistory()).toEqual([]);
  });
});
