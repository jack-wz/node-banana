/**
 * StickyNoteNode — free-floating text note on the canvas (Weavy sticky note
 * parity). Cream-tinted card, no handles, not runnable. Text is stored in
 * node data and persisted with the workflow.
 */

"use client";

import { memo, useCallback } from "react";
import { NodeProps, NodeResizer } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflowStore";
import type { WorkflowNode, StickyNoteNodeData } from "@/types";

export const StickyNoteNode = memo(({ id, data, selected }: NodeProps<WorkflowNode>) => {
  const nodeData = data as StickyNoteNodeData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { text: event.target.value });
    },
    [id, updateNodeData]
  );

  return (
    <div
      className={`w-full h-full rounded-xl border transition-shadow ${
        selected
          ? "ring-2 ring-inset ring-white/[0.64] border-transparent"
          : "border-[#d8d4b8]/20"
      }`}
      style={{
        background: "rgba(254, 255, 241, 0.08)",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.25)",
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={120}
        lineStyle={{ borderColor: "rgba(255,255,255,0.3)" }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, background: "#fefff1", border: "none" }}
      />
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FEFFF1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#fefff1]/70">
          Note
        </span>
      </div>
      <textarea
        value={nodeData.text ?? ""}
        onChange={handleChange}
        placeholder="Write a note…"
        className="nodrag nopan nowheel w-full h-[calc(100%-32px)] px-3 pb-3 bg-transparent resize-none outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
      />
    </div>
  );
});

StickyNoteNode.displayName = "StickyNoteNode";
