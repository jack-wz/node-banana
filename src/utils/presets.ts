/**
 * Workflow presets — save selected nodes/edges as reusable presets
 * (Weavy "Save node/group" parity). Persisted in localStorage.
 *
 * Schema v1: { id, name, version, createdAt, nodes, edges }
 */

import { useWorkflowStore } from "@/store/workflowStore";
import type { WorkflowNode, WorkflowEdge } from "@/types";

const PRESETS_KEY = "node-banana-presets";

export interface WorkflowPreset {
  id: string;
  name: string;
  version: 1;
  createdAt: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export function loadPresets(): WorkflowPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is WorkflowPreset =>
        p && typeof p.id === "string" && Array.isArray(p.nodes) && Array.isArray(p.edges)
    );
  } catch {
    return [];
  }
}

function persistPresets(presets: WorkflowPreset[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function deletePreset(id: string): void {
  persistPresets(loadPresets().filter((p) => p.id !== id));
}

/** Save a workflow preset. */
export function savePreset(preset: WorkflowPreset): void {
  persistPresets([...loadPresets(), preset]);
}

/**
 * Save the currently selected nodes (and edges between them) as a preset.
 * Returns the created preset, or null when nothing is selected.
 */
export function savePresetFromSelection(name: string): WorkflowPreset | null {
  const { nodes, edges } = useWorkflowStore.getState();
  const selectedNodes = nodes.filter((n) => n.selected);
  if (selectedNodes.length === 0) return null;

  const selectedIds = new Set(selectedNodes.map((n) => n.id));
  const presetEdges = edges.filter(
    (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
  );

  const preset: WorkflowPreset = {
    id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Untitled preset",
    version: 1,
    createdAt: Date.now(),
    nodes: JSON.parse(JSON.stringify(selectedNodes)),
    edges: JSON.parse(JSON.stringify(presetEdges)),
  };

  savePreset(preset);
  return preset;
}

/**
 * Insert a preset into the current workflow by routing it through the
 * clipboard + paste pipeline (new IDs, offset position, selection fix-up).
 */
export function applyPreset(preset: WorkflowPreset): void {
  useWorkflowStore.setState({
    clipboard: {
      nodes: JSON.parse(JSON.stringify(preset.nodes)),
      edges: JSON.parse(JSON.stringify(preset.edges)),
    },
  });
  useWorkflowStore.getState().pasteNodes({ x: 40, y: 40 });
}
