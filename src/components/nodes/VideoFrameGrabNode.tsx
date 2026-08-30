"use client";

import React, { useMemo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { VideoFrameGrabNodeData } from "@/types";
import { useAdaptiveImageSrc } from "@/hooks/useAdaptiveImageSrc";
import { useShowHandleLabels } from "@/hooks/useShowHandleLabels";
import { HandleLabel } from "./HandleLabel";
import { useT } from "@/i18n";

type VideoFrameGrabNodeType = Node<VideoFrameGrabNodeData, "videoFrameGrab">;

export function VideoFrameGrabNode({ id, data, selected }: NodeProps<VideoFrameGrabNodeType>) {
  const t = useT();
  const nodeData = data;
  const adaptiveOutputImage = useAdaptiveImageSrc(nodeData.outputImage, id);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const showLabels = useShowHandleLabels(selected);

  // Find connected source video from incoming edges
  const sourceVideoUrl = useMemo(() => {
    const incomingEdge = edges.find((e) => e.target === id && e.targetHandle === "video");
    if (!incomingEdge) return null;

    const sourceNode = nodes.find((n) => n.id === incomingEdge.source);
    if (!sourceNode) return null;

    const d = sourceNode.data as Record<string, unknown>;
    return (d.outputVideo as string | null) ?? null;
  }, [edges, nodes, id]);

  const hasSourceVideo = Boolean(sourceVideoUrl);
  const canExtract = hasSourceVideo && nodeData.status !== "loading" && !isRunning;

  const handleExtract = () => {
    regenerateNode(id);
  };

  // Compact by default: the First/Last + Extract controls live behind an
  // expand toggle so the node stays small and never covers its handles.
  const collapsed = nodeData.controlsCollapsed ?? true;
  const toggleCollapsed = () =>
    updateNodeData(id, { controlsCollapsed: !collapsed });

  return (
    <BaseNode
      id={id}
      selected={selected}
      isExecuting={isRunning}
      hasError={nodeData.status === "error"}
      minWidth={320}
      minHeight={collapsed ? 200 : 320}
      aspectFitMedia={nodeData.outputImage}
    >
      {/* Video In (target, left, 50%) */}
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        data-handletype="video"
        isConnectable={true}
        style={{ top: "50%" }}
      />
      <HandleLabel label="Video In" side="target" color="var(--handle-color-video)" top="calc(50% - 7px)" visible={showLabels} />

      {/* Image Out (source, right, 50%) */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        data-handletype="image"
        isConnectable={true}
        style={{ top: "50%" }}
      />
      <HandleLabel label="Image Out" side="source" color="rgb(59, 130, 246)" top="calc(50% - 7px)" visible={showLabels} />

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Image preview area */}
        <div className="flex-1 min-h-0 relative">
          {nodeData.outputImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- runtime workflow media routed through useAdaptiveImageSrc's zoom-based thumbnail system, not a static asset */}
              <img
                src={adaptiveOutputImage ?? undefined}
                className="absolute inset-0 w-full h-full object-contain rounded"
                alt="Extracted frame"
              />
              {/* Clear output button */}
              <button
                onClick={() => updateNodeData(id, { outputImage: null, status: "idle" })}
                className="absolute top-1 right-1 w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                title={t("node.clearFrame")}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center border border-dashed border-neutral-600 rounded">
              <span className="text-[10px] text-neutral-500 text-center px-4">
                {t("node.connectVideoHint")}
              </span>
            </div>
          )}
        </div>

        {!collapsed && (
          <>
        {/* Frame position toggle */}
        <div className="nodrag nowheel shrink-0 flex gap-1 px-1">
          <button
            onClick={() => updateNodeData(id, { framePosition: "first", outputImage: null })}
            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              nodeData.framePosition === "first"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t("node.frameFirst")}
          </button>
          <button
            onClick={() => updateNodeData(id, { framePosition: "last", outputImage: null })}
            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              nodeData.framePosition === "last"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t("node.frameLast")}
          </button>
        </div>

        {/* Extract Frame button */}
        <div className="shrink-0 flex justify-end px-1">
          <button
            onClick={handleExtract}
            disabled={!canExtract}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed rounded text-white text-xs font-medium transition-colors"
          >
            {nodeData.status === "loading" ? t("node.extractingFrame") : t("node.extractFrame")}
          </button>
        </div>
          </>
        )}

        {/* Collapse/expand bar — compact summary + chevron, always visible */}
        <div className="nodrag shrink-0 flex items-center justify-between px-1">
          <span className="text-[10px] text-neutral-500">
            {nodeData.framePosition === "first" ? t("node.frameFirst") : t("node.frameLast")}
          </span>
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors"
            title={collapsed ? t("node.expandControls") : t("node.collapseControls")}
          >
            {collapsed ? t("node.expandControls") : t("node.collapseControls")}
            <svg
              className={`w-3 h-3 transition-transform ${collapsed ? "" : "rotate-180"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Processing overlay */}
        {nodeData.status === "loading" && (
          <div className="absolute inset-0 bg-neutral-900/70 rounded flex flex-col items-center justify-center gap-2">
            <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-white text-xs">{t("node.extractingFrame")}</span>
          </div>
        )}

        {/* Error display */}
        {nodeData.status === "error" && nodeData.error && (
          <div className="shrink-0 px-2 py-1.5 bg-red-900/30 border border-red-700/50 rounded">
            <p className="text-[10px] text-red-400 break-words">{nodeData.error}</p>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
