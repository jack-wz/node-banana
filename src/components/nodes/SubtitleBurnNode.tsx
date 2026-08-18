"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { SubtitleBurnNodeData, SubtitleStylePreset } from "@/types";
import { checkEncoderSupport } from "@/hooks/useStitchVideos";
import { useVideoBlobUrl } from "@/hooks/useVideoBlobUrl";
import { useVideoAutoplay } from "@/hooks/useVideoAutoplay";
import { useShowHandleLabels } from "@/hooks/useShowHandleLabels";
import { HandleLabel } from "./HandleLabel";
import { useT } from "@/i18n";

type SubtitleBurnNodeType = Node<SubtitleBurnNodeData, "subtitleBurn">;

const STYLE_PRESETS: SubtitleStylePreset[] = [
  "default",
  "minimal",
  "bold",
  "centered",
  "modern",
  "elegant",
  "casual",
];

export function SubtitleBurnNode({ id, data, selected }: NodeProps<SubtitleBurnNodeType>) {
  const t = useT();
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const videoAutoplayRef = useVideoAutoplay(id, selected);
  const showLabels = useShowHandleLabels(selected);
  const [showOutput, setShowOutput] = useState(false);

  // Check encoder support on mount
  useEffect(() => {
    if (nodeData.encoderSupported === null) {
      checkEncoderSupport().then((supported) => {
        updateNodeData(id, { encoderSupported: supported });
      });
    }
  }, [id, nodeData.encoderSupported, updateNodeData]);

  // Find connected source video
  const sourceVideoUrl = (() => {
    const incomingEdge = edges.find((e) => e.target === id && e.targetHandle === "video");
    if (!incomingEdge) return null;
    const sourceNode = nodes.find((n) => n.id === incomingEdge.source);
    if (!sourceNode) return null;
    const d = sourceNode.data as Record<string, unknown>;
    return (d.outputVideo as string | null) ?? null;
  })();

  // Mirror a connected SRT input into srtText, unless the user has hand-edited it.
  const connectedSrt = (() => {
    const incomingEdge = edges.find((e) => e.target === id && e.targetHandle === "srt");
    if (!incomingEdge) return null;
    const sourceNode = nodes.find((n) => n.id === incomingEdge.source);
    if (!sourceNode) return null;
    const d = sourceNode.data as Record<string, unknown>;
    return (d.outputSrt as string | null) ?? null;
  })();

  // Initialize to undefined (distinct from both null and any string) so the
  // very first mount also syncs — a saved workflow reopening with a connected
  // transcribe node must populate srtText without waiting for a change.
  const prevConnectedSrtRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (connectedSrt !== prevConnectedSrtRef.current) {
      prevConnectedSrtRef.current = connectedSrt;
      if (connectedSrt !== null && nodeData.srtSource !== "manual") {
        updateNodeData(id, { srtText: connectedSrt, srtSource: "connected" });
      }
    }
  }, [connectedSrt, nodeData.srtSource, id, updateNodeData]);

  const handleSrtTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { srtText: e.target.value, srtSource: "manual" });
    },
    [id, updateNodeData]
  );

  const handleStylePresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { stylePreset: e.target.value as SubtitleStylePreset });
    },
    [id, updateNodeData]
  );

  const handlePositionChange = useCallback(
    (position: SubtitleBurnNodeData["position"]) => {
      updateNodeData(id, { position });
    },
    [id, updateNodeData]
  );

  const handleBurn = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  // Auto-switch to output preview when burn completes
  const prevOutputVideoRef = useRef(nodeData.outputVideo);
  useEffect(() => {
    if (!prevOutputVideoRef.current && nodeData.outputVideo) {
      setShowOutput(true);
    }
    prevOutputVideoRef.current = nodeData.outputVideo;
  }, [nodeData.outputVideo]);

  const hasSourceVideo = Boolean(sourceVideoUrl);
  const hasSrt = nodeData.srtText.trim().length > 0;
  const canBurn = hasSourceVideo && hasSrt;

  const previewUrl = showOutput && nodeData.outputVideo ? nodeData.outputVideo : sourceVideoUrl;
  const previewBlobUrl = useVideoBlobUrl(previewUrl);

  const renderHandles = () => (
    <>
      {/* Video In (target, left, 35%) */}
      <Handle type="target" position={Position.Left} id="video" data-handletype="video" isConnectable={true} style={{ top: "35%" }} />
      <HandleLabel label={t("subtitleBurn.videoIn")} side="target" color="var(--handle-color-video)" top="calc(35% - 7px)" visible={showLabels} />

      {/* SRT In (target, left, 65%) */}
      <Handle type="target" position={Position.Left} id="srt" data-handletype="text" isConnectable={true} style={{ top: "65%" }} />
      <HandleLabel label={t("subtitleBurn.srtIn")} side="target" color="var(--handle-color-text)" top="calc(65% - 7px)" visible={showLabels} />

      {/* Video Out (source, right, 50%) */}
      <Handle type="source" position={Position.Right} id="video" data-handletype="video" isConnectable={true} style={{ top: "50%" }} />
      <HandleLabel label={t("subtitleBurn.videoOut")} side="source" color="var(--handle-color-video)" top="calc(50% - 7px)" visible={showLabels} />
    </>
  );

  // Encoder not supported
  if (nodeData.encoderSupported === false) {
    return (
      <BaseNode id={id} selected={selected} minWidth={400} minHeight={360}>
        {renderHandles()}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-4">
          <span className="text-xs text-neutral-400">{t("subtitleBurn.encoderUnsupported")}</span>
        </div>
      </BaseNode>
    );
  }

  return (
    <BaseNode
      id={id}
      selected={selected}
      isExecuting={isRunning}
      hasError={nodeData.status === "error"}
      contentClassName="flex-1 min-h-0"
      minWidth={400}
      minHeight={360}
      aspectFitMedia={nodeData.outputVideo}
    >
      {renderHandles()}

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Video preview */}
        <div className="flex-1 min-h-0 relative">
          {previewUrl ? (
            <video
              ref={videoAutoplayRef}
              key={previewUrl}
              src={previewBlobUrl ?? undefined}
              controls
              playsInline
              muted
              loop
              className="absolute inset-0 w-full h-full object-contain rounded"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center border border-dashed border-neutral-600 rounded">
              <span className="text-[10px] text-neutral-500">{t("subtitleBurn.connectHint")}</span>
            </div>
          )}

          {nodeData.outputVideo && sourceVideoUrl && (
            <div className="absolute top-1 left-1 flex gap-1">
              <button
                onClick={() => setShowOutput(false)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                  !showOutput ? "bg-neutral-700 text-neutral-200" : "bg-neutral-900/70 text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {t("subtitleBurn.source")}
              </button>
              <button
                onClick={() => setShowOutput(true)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                  showOutput ? "bg-blue-600 text-white" : "bg-neutral-900/70 text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {t("subtitleBurn.burned")}
              </button>
            </div>
          )}
        </div>

        {/* SRT text (editable) */}
        <div className="shrink-0 nodrag nowheel">
          <textarea
            value={nodeData.srtText}
            onChange={handleSrtTextChange}
            placeholder={t("subtitleBurn.srtPlaceholder")}
            rows={3}
            className="w-full bg-neutral-800 text-neutral-200 text-[10px] font-mono rounded px-2 py-1.5 border border-neutral-700 outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Style + position controls */}
        <div className="shrink-0 flex items-center gap-2 px-1">
          <select
            value={nodeData.stylePreset}
            onChange={handleStylePresetChange}
            className="nodrag flex-1 bg-neutral-800 text-neutral-200 text-[11px] rounded px-1.5 py-1 border border-neutral-700 outline-none focus:border-blue-500"
          >
            {STYLE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {t(`subtitleBurn.style.${preset}`)}
              </option>
            ))}
          </select>
          <div className="flex gap-0.5">
            {(["top", "center", "bottom"] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => handlePositionChange(pos)}
                className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                  nodeData.position === pos
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                }`}
                title={t(`subtitleBurn.position.${pos}`)}
              >
                {t(`subtitleBurn.positionShort.${pos}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Burn button */}
        <div className="shrink-0 flex justify-end px-1">
          <button
            onClick={handleBurn}
            disabled={!canBurn || nodeData.status === "loading" || isRunning}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed rounded text-white text-xs font-medium transition-colors"
          >
            {nodeData.status === "loading" ? t("subtitleBurn.burning") : t("subtitleBurn.burn")}
          </button>
        </div>

        {/* Processing overlay */}
        {nodeData.status === "loading" && (
          <div className="absolute inset-0 bg-neutral-900/70 rounded flex flex-col items-center justify-center gap-2">
            <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-white text-xs">{t("subtitleBurn.burning")} {Math.round(nodeData.progress)}%</span>
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
