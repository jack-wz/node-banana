"use client";

import { useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { TranscribeNodeData } from "@/types";
import { useShowHandleLabels } from "@/hooks/useShowHandleLabels";
import { HandleLabel } from "./HandleLabel";
import { useT } from "@/i18n";

type TranscribeNodeType = Node<TranscribeNodeData, "transcribe">;

const LANGUAGE_OPTIONS: { value: TranscribeNodeData["language"]; labelKey: string }[] = [
  { value: "auto", labelKey: "transcribe.langAuto" },
  { value: "zh", labelKey: "transcribe.langZh" },
  { value: "en", labelKey: "transcribe.langEn" },
  { value: "other", labelKey: "transcribe.langOther" },
];

export function TranscribeNode({ id, data, selected }: NodeProps<TranscribeNodeType>) {
  const t = useT();
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const edges = useWorkflowStore((state) => state.edges);
  const showLabels = useShowHandleLabels(selected);

  const hasSourceInput = edges.some((e) => e.target === id && e.targetHandle === "media");

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { language: e.target.value as TranscribeNodeData["language"] });
    },
    [id, updateNodeData]
  );

  const handleTranscribe = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  const handleCopy = useCallback(() => {
    if (nodeData.outputSrt) {
      navigator.clipboard.writeText(nodeData.outputSrt).catch(() => {});
    }
  }, [nodeData.outputSrt]);

  const renderHandles = () => (
    <>
      {/* Media In (target, left, 50%) — accepts video or audio */}
      <Handle
        type="target"
        position={Position.Left}
        id="media"
        data-handletype="video"
        isConnectable={true}
        style={{ top: "50%" }}
      />
      <HandleLabel label={t("transcribe.mediaIn")} side="target" color="var(--handle-color-video)" top="calc(50% - 7px)" visible={showLabels} />

      {/* SRT Out (source, right, 50%) */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        data-handletype="text"
        isConnectable={true}
        style={{ top: "50%" }}
      />
      <HandleLabel label={t("transcribe.srtOut")} side="source" color="var(--handle-color-text)" top="calc(50% - 7px)" visible={showLabels} />
    </>
  );

  return (
    <BaseNode
      id={id}
      selected={selected}
      isExecuting={isRunning}
      hasError={nodeData.status === "error"}
      contentClassName="flex-1 min-h-0"
      minWidth={340}
      minHeight={260}
    >
      {renderHandles()}

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Language selector */}
        <div className="shrink-0 flex items-center justify-between px-1 gap-2">
          <span className="text-[10px] text-neutral-400">{t("transcribe.language")}</span>
          <select
            value={nodeData.language}
            onChange={handleLanguageChange}
            className="nodrag flex-1 bg-neutral-800 text-neutral-200 text-[11px] rounded px-1.5 py-1 border border-neutral-700 outline-none focus:border-blue-500"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>

        {/* SRT preview */}
        <div className="flex-1 min-h-0 relative">
          {nodeData.outputSrt ? (
            <div className="absolute inset-0 overflow-y-auto nowheel nodrag bg-neutral-900/50 rounded p-2">
              <pre className="text-[9px] text-neutral-300 whitespace-pre-wrap font-mono">{nodeData.outputSrt}</pre>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center border border-dashed border-neutral-600 rounded">
              <span className="text-[10px] text-neutral-500 text-center px-2">
                {hasSourceInput ? t("transcribe.readyHint") : t("transcribe.connectHint")}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center justify-between px-1 gap-2">
          {nodeData.outputSrt ? (
            <button
              onClick={handleCopy}
              className="px-2 py-1 text-[10px] text-neutral-300 hover:text-neutral-100 hover:bg-neutral-700/60 rounded transition-colors"
            >
              {t("transcribe.copySrt")}
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={handleTranscribe}
            disabled={!hasSourceInput || nodeData.status === "loading" || isRunning}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed rounded text-white text-xs font-medium transition-colors"
          >
            {nodeData.status === "loading" ? t("transcribe.transcribing") : t("transcribe.transcribe")}
          </button>
        </div>

        {/* Processing overlay */}
        {nodeData.status === "loading" && (
          <div className="absolute inset-0 bg-neutral-900/70 rounded flex flex-col items-center justify-center gap-2">
            <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-white text-xs">{t("transcribe.transcribing")} {Math.round(nodeData.progress)}%</span>
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
