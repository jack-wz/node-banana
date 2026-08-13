/**
 * Version history — automatic workflow snapshots (Weavy version-history
 * parity). Up to 20 snapshots in localStorage.
 *
 * Snapshots capture the graph structure (nodes/edges/data). Inline base64
 * media is stripped to keep localStorage small; externally-referenced media
 * (*Ref fields) is preserved. Restoring a snapshot restores structure and
 * parameters, not binary payloads.
 */

import { useWorkflowStore } from "@/store/workflowStore";
import type { WorkflowNode, WorkflowEdge } from "@/types";

const HISTORY_KEY = "node-banana-version-history";
export const MAX_SNAPSHOTS = 20;

export interface VersionSnapshot {
  id: string;
  at: number;
  label: string;
  nodeCount: number;
  edgeCount: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

function isInlineMedia(value: unknown): boolean {
  return typeof value === "string" && (value.startsWith("data:") || value.startsWith("blob:"));
}

/** Deep-clone node data with inline base64/blob media replaced by null. */
function stripMediaFromData(data: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (isInlineMedia(value)) return null;
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((item) => isInlineMedia(item))
      ) {
        return [];
      }
      return value;
    })
  );
  return clone;
}

export function loadHistory(): VersionSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is VersionSnapshot =>
        s && typeof s.id === "string" && Array.isArray(s.nodes) && Array.isArray(s.edges)
    );
  } catch {
    return [];
  }
}

function persistHistory(snapshots: VersionSnapshot[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(snapshots));
  } catch {
    // Quota exceeded — drop the oldest half and retry once
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(snapshots.slice(0, Math.ceil(snapshots.length / 2))));
    } catch {
      // Give up silently — history is best-effort
    }
  }
}

/** Capture the current workflow as a new snapshot. */
export function captureSnapshotNow(label?: string): VersionSnapshot | null {
  const { nodes, edges } = useWorkflowStore.getState();
  if (nodes.length === 0) return null;

  const snapshot: VersionSnapshot = {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    label: label ?? `${nodes.length} nodes`,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes: nodes.map((node) => ({
      ...node,
      data: stripMediaFromData(node.data as Record<string, unknown>),
    })) as WorkflowNode[],
    edges: JSON.parse(JSON.stringify(edges)),
  };

  persistHistory([snapshot, ...loadHistory()].slice(0, MAX_SNAPSHOTS));
  return snapshot;
}

export function deleteSnapshot(id: string): void {
  persistHistory(loadHistory().filter((s) => s.id !== id));
}

/** Restore a snapshot's nodes/edges into the canvas. */
export function restoreSnapshot(id: string): boolean {
  const snapshot = loadHistory().find((s) => s.id === id);
  if (!snapshot) return false;
  useWorkflowStore.setState({
    nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
    edges: JSON.parse(JSON.stringify(snapshot.edges)),
    hasUnsavedChanges: true,
  });
  return true;
}
