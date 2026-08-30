"use client";

import React, { useEffect, useMemo, useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { EaseCurveNodeData } from "@/types";
import { checkEncoderSupport } from "@/hooks/useStitchVideos";
import { useVideoBlobUrl } from "@/hooks/useVideoBlobUrl";
import { useVideoAutoplay } from "@/hooks/useVideoAutoplay";
import { useShowHandleLabels } from "@/hooks/useShowHandleLabels";
import { HandleLabel } from "./HandleLabel";
import { useT } from "@/i18n";
import { CubicBezierEditor } from "@/components/CubicBezierEditor";
import { EASING_PRESETS, getEasingBezier } from "@/lib/easing-presets";
import { generateEasingPolyline } from "@/lib/easing-functions";

type EaseCurveNodeType = Node<EaseCurveNodeData, "easeCurve">;


export function EaseCurveNode({ id, data, selected }: NodeProps<EaseCurveNodeType>) {
  const t = useT();
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const edges = useWorkflowStore((state) => state.edges);
  const videoBlobUrl = useVideoBlobUrl(nodeData.outputVideo ?? null);
  const videoAutoplayRef = useVideoAutoplay(id, selected);
  const showLabels = useShowHandleLabels(selected);

  // Check encoder support on mount
  useEffect(() => {
    if (nodeData.encoderSupported === null) {
      checkEncoderSupport().then((supported) => {
        updateNodeData(id, { encoderSupported: supported });
      });
    }
  }, [id, nodeData.encoderSupported, updateNodeData]);

  // Inline curve editing: an easeCurve connection means settings are
  // inherited from upstream — mirror the side panel's inherited overlay.
  const isInherited = edges.some((e) => e.target === id && e.targetHandle === "easeCurve");

  const handleBezierChange = useCallback(
    (value: [number, number, number, number]) => {
      updateNodeData(id, { bezierHandles: value, easingPreset: null });
    },
    [id, updateNodeData]
  );

  const handleSelectPreset = useCallback(
    (name: string) => {
      updateNodeData(id, { easingPreset: name, bezierHandles: getEasingBezier(name) });
    },
    [id, updateNodeData]
  );

  const editorEasingCurve = useMemo(() => {
    if (!nodeData.easingPreset) return undefined;
    return generateEasingPolyline(nodeData.easingPreset, 100, 100, 50);
  }, [nodeData.easingPreset]);

  // Preset chips with mini curve thumbnails (same set as the side panel).
  const presetChips = useMemo(
    () => EASING_PRESETS.map((name) => ({ name, polyline: generateEasingPolyline(name, 36, 36) })),
    []
  );

  // Shared handles rendered in ALL states (4 handles with labels)
  const renderHandles = () => (
    <>
      {/* Video In (target, left, 35%) */}
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        data-handletype="video"
        isConnectable={true}
        style={{ top: "35%" }}
      />
      <HandleLabel label="Video In" side="target" color="var(--handle-color-video)" top="calc(35% - 7px)" visible={showLabels} />

      {/* Video Out (source, right, 35%) */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        data-handletype="video"
        isConnectable={true}
        style={{ top: "35%" }}
      />
      <HandleLabel label="Video Out" side="source" color="var(--handle-color-video)" top="calc(35% - 7px)" visible={showLabels} />

      {/* Settings In (target, left, 75%) */}
      <Handle
        type="target"
        position={Position.Left}
        id="easeCurve"
        data-handletype="easeCurve"
        isConnectable={true}
        style={{ top: "75%", background: "rgb(190, 242, 100)" }}
      />
      <HandleLabel label="Settings" side="target" color="rgb(190, 242, 100)" top="calc(75% - 7px)" visible={showLabels} />

      {/* Settings Out (source, right, 75%) */}
      <Handle
        type="source"
        position={Position.Right}
        id="easeCurve"
        data-handletype="easeCurve"
        isConnectable={true}
        style={{ top: "75%", background: "rgb(190, 242, 100)" }}
      />
      <HandleLabel label="Settings" side="source" color="rgb(190, 242, 100)" top="calc(75% - 7px)" visible={showLabels} />
    </>
  );

  // Encoder not supported
  if (nodeData.encoderSupported === false) {
    return (
      <BaseNode
        id={id}
        selected={selected}
        fullBleed
        minWidth={340}
      >
        {renderHandles()}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-4">
          <svg className="w-8 h-8 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-xs text-neutral-400">
            Your browser doesn&apos;t support video encoding.
          </span>
          <a
            href="https://discord.com/invite/89Nr6EKkTf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-400 hover:text-blue-300 underline"
          >
            Doesn&apos;t seem right? Message Willie on Discord.
          </a>
        </div>
      </BaseNode>
    );
  }

  // Checking encoder state
  if (nodeData.encoderSupported === null) {
    return (
      <BaseNode
        id={id}
        selected={selected}
        fullBleed
        minWidth={340}
      >
        {renderHandles()}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-neutral-400">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs">{t("node.checkingEncoder")}</span>
          </div>
        </div>
      </BaseNode>
    );
  }

  return (
    <BaseNode
      id={id}
      selected={selected}
      fullBleed
      isExecuting={isRunning}
      hasError={nodeData.status === "error"}
      minWidth={340}
      aspectFitMedia={nodeData.outputVideo}
    >
      {renderHandles()}

      {/* Video preview (full-bleed) */}
      {nodeData.outputVideo ? (
        <div className="relative w-full h-full">
          <video
            ref={videoAutoplayRef}
            src={videoBlobUrl ?? undefined}
            controls
            loop
            muted
            className="absolute inset-0 w-full h-full object-contain rounded-lg"
            playsInline
          />
          <button
            onClick={() => updateNodeData(id, { outputVideo: null, status: "idle" })}
            className="absolute top-1 right-1 w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            title={t("node.clearVideo")}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col bg-neutral-900/40 rounded-lg p-3 gap-2 nodrag nowheel">
          {isInherited ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-1">
              <span className="text-xs text-neutral-300">{t("node.settingsInherited")}</span>
              <span className="text-[10px] text-neutral-500">{t("node.breakConnection")}</span>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 flex items-center">
                <div className="w-full max-w-[220px] mx-auto">
                  <CubicBezierEditor
                    value={nodeData.bezierHandles || [0.42, 0, 0.58, 1]}
                    onChange={handleBezierChange}
                    onCommit={handleBezierChange}
                    easingCurve={editorEasingCurve}
                  />
                </div>
              </div>
              <div className="flex items-center justify-center gap-1.5 shrink-0">
                {presetChips.map((chip) => (
                  <button
                    key={chip.name}
                    onClick={() => handleSelectPreset(chip.name)}
                    title={chip.name}
                    className={`w-8 h-8 rounded border transition-colors ${
                      nodeData.easingPreset === chip.name
                        ? "border-lime-300/70 bg-lime-300/10"
                        : "border-neutral-700 hover:border-neutral-500 bg-neutral-800/50"
                    }`}
                  >
                    <svg viewBox="0 0 36 36" className="w-full h-full p-1">
                      <polyline
                        points={chip.polyline}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={nodeData.easingPreset === chip.name ? "text-lime-300" : "text-neutral-400"}
                      />
                    </svg>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-neutral-500 text-center shrink-0">{t("node.applyEaseHint")}</p>
            </>
          )}
        </div>
      )}

      {/* Processing overlay */}
      {nodeData.status === "loading" && (
        <div className="absolute inset-0 bg-neutral-900/70 rounded-lg flex flex-col items-center justify-center gap-2">
          <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-white text-xs">Processing... {Math.round(nodeData.progress)}%</span>
        </div>
      )}

      {/* Error display */}
      {nodeData.status === "error" && nodeData.error && (
        <div className="absolute bottom-2 left-2 right-2 px-2 py-1.5 bg-red-900/30 border border-red-700/50 rounded">
          <p className="text-[10px] text-red-400 break-words">{nodeData.error}</p>
        </div>
      )}
    </BaseNode>
  );
}
