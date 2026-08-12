/**
 * NodeSettingsPanel — Weavy-parity right panel (240px) that externalizes
 * node parameters for the selected node. Currently covers the two highest
 * frequency node types (Generate Image / LLM Generate); other node types
 * keep their in-node editors.
 */

"use client";

import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { useWorkflowStore } from "@/store/workflowStore";
import type {
  AspectRatio,
  Resolution,
  NanoBananaNodeData,
  GenerateVideoNodeData,
  Generate3DNodeData,
  GenerateAudioNodeData,
  LLMGenerateNodeData,
  WorkflowNode,
} from "@/types";
import { HandleTypeIcon, nodeTypeToIconType } from "./nodes/HandleTypeIcon";
import { ModelParameters } from "./nodes/ModelParameters";
import { useT } from "@/i18n";
import { calculateGenerationCost, formatCost } from "@/utils/costCalculator";
import { useInlineParameters } from "@/hooks/useInlineParameters";

const SUPPORTED_TYPES = new Set(["nanoBanana", "llmGenerate", "generateVideo", "generate3d", "generateAudio"]);

const BASE_ASPECT_RATIOS: AspectRatio[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const EXTENDED_ASPECT_RATIOS: AspectRatio[] = ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"];
const RESOLUTIONS_PRO: Resolution[] = ["1K", "2K", "4K"];
const RESOLUTIONS_NB2: Resolution[] = ["512", "1K", "2K", "4K"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
      {children}
    </div>
  );
}

function GenerateImageSettings({ node }: { node: WorkflowNode }) {
  const t = useT();
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const data = node.data as NanoBananaNodeData;
  const currentModelId = data.selectedModel?.modelId || data.model;
  const aspectRatios = currentModelId === "nano-banana-2" ? EXTENDED_ASPECT_RATIOS : BASE_ASPECT_RATIOS;
  const resolutions = currentModelId === "nano-banana-2" ? RESOLUTIONS_NB2 : RESOLUTIONS_PRO;
  const isPro = currentModelId === "nano-banana-pro" || currentModelId === "nano-banana-2";

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>{t("settingsPanel.model")}</SectionLabel>
        <div className="text-sm text-neutral-200 truncate">
          {data.selectedModel?.displayName || data.model}
        </div>
      </div>

      <div>
        <SectionLabel>{t("settingsPanel.aspectRatio")}</SectionLabel>
        <div className="grid grid-cols-5 gap-1">
          {aspectRatios.map((ratio) => (
            <button
              key={ratio}
              onClick={() => updateNodeData(node.id, { aspectRatio: ratio })}
              className={`px-1 py-1 text-[10px] font-medium rounded transition-colors ${
                data.aspectRatio === ratio
                  ? "bg-neutral-100 text-neutral-900"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {isPro && (
        <div>
          <SectionLabel>{t("settingsPanel.resolution")}</SectionLabel>
          <div className="grid grid-cols-4 gap-1">
            {resolutions.map((res) => (
              <button
                key={res}
                onClick={() => updateNodeData(node.id, { resolution: res })}
                className={`px-1 py-1 text-[10px] font-medium rounded transition-colors ${
                  data.resolution === res
                    ? "bg-neutral-100 text-neutral-900"
                    : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel>{t("settingsPanel.runs")}</SectionLabel>
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((count) => (
            <button
              key={count}
              onClick={() => updateNodeData(node.id, { runs: count })}
              className={`px-1 py-1 text-[10px] font-medium rounded transition-colors ${
                (data.runs ?? 1) === count
                  ? "bg-neutral-100 text-neutral-900"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              ×{count}
            </button>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-neutral-500">
          {(data.runs ?? 1) > 1
            ? t("settingsPanel.perRunMany", { count: data.runs ?? 1 })
            : t("settingsPanel.perRunOne")}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
          <input
            type="checkbox"
            checked={data.useGoogleSearch}
            onChange={(e) => updateNodeData(node.id, { useGoogleSearch: e.target.checked })}
            className="accent-neutral-200"
          />
          {t("settingsPanel.searchGrounding")}
        </label>
        {currentModelId === "nano-banana-2" && (
          <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={data.useImageSearch}
              onChange={(e) => updateNodeData(node.id, { useImageSearch: e.target.checked })}
              className="accent-neutral-200"
            />
            {t("settingsPanel.imageSearch")}
          </label>
        )}
      </div>
    </div>
  );
}

function LLMSettings({ node }: { node: WorkflowNode }) {
  const t = useT();
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const data = node.data as LLMGenerateNodeData;

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>{t("settingsPanel.providerModel")}</SectionLabel>
        <div className="text-sm text-neutral-200 truncate">
          {data.provider} · {data.model}
        </div>
      </div>

      <div>
        <SectionLabel>{t("settingsPanel.temperature")} — {data.temperature.toFixed(2)}</SectionLabel>
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={data.temperature}
          onChange={(e) => updateNodeData(node.id, { temperature: Number(e.target.value) })}
          className="w-full accent-neutral-200"
        />
      </div>

      <div>
        <SectionLabel>{t("settingsPanel.maxTokens")}</SectionLabel>
        <input
          type="number"
          min={1}
          value={data.maxTokens}
          onChange={(e) => {
            const value = Math.max(1, Number(e.target.value) || 1);
            updateNodeData(node.id, { maxTokens: value });
          }}
          className="w-full bg-neutral-800 text-sm text-neutral-100 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-neutral-500"
        />
      </div>
    </div>
  );
}

type ExternalGenerationNodeData = GenerateVideoNodeData | Generate3DNodeData | GenerateAudioNodeData;

function ExternalGenerationSettings({ node }: { node: WorkflowNode }) {
  const t = useT();
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const data = node.data as ExternalGenerationNodeData;

  // Stabilize callback to prevent infinite re-render with ModelParameters useEffect deps
  const handleParametersChange = useCallback(
    (parameters: Record<string, unknown>) => updateNodeData(node.id, { parameters }),
    [node.id, updateNodeData]
  );

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>{t("settingsPanel.model")}</SectionLabel>
        <div className="text-sm text-neutral-200 truncate">
          {data.selectedModel?.displayName || "—"}
        </div>
      </div>

      {data.selectedModel?.modelId && (
        <ModelParameters
          modelId={data.selectedModel.modelId}
          provider={data.selectedModel.provider}
          parameters={data.parameters || {}}
          onParametersChange={handleParametersChange}
        />
      )}
    </div>
  );
}

function GenerateVideoSettings({ node }: { node: WorkflowNode }) {
  return <ExternalGenerationSettings node={node} />;
}

function Generate3DSettings({ node }: { node: WorkflowNode }) {
  return <ExternalGenerationSettings node={node} />;
}

function GenerateAudioSettings({ node }: { node: WorkflowNode }) {
  return <ExternalGenerationSettings node={node} />;
}

function getNodeTitle(type: string | undefined, t: ReturnType<typeof useT>) {
  switch (type) {
    case "nanoBanana":
      return t("settingsPanel.generateImage");
    case "generateVideo":
      return t("settingsPanel.generateVideo");
    case "generate3d":
      return t("settingsPanel.generate3d");
    case "generateAudio":
      return t("settingsPanel.generateAudio");
    default:
      return t("settingsPanel.llmGenerate");
  }
}

export function NodeSettingsPanel() {
  const t = useT();
  const nodes = useWorkflowStore(useShallow((state) => state.nodes));
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const { inlineParametersEnabled } = useInlineParameters();

  const selectedNode = useMemo(() => {
    // When inline parameters are enabled (shown inside nodes), the right
    // settings panel should NOT appear — they serve the same purpose and
    // would visually overlap.
    if (inlineParametersEnabled) return null;
    const selected = nodes.filter((n) => n.selected);
    if (selected.length !== 1) return null;
    const node = selected[0];
    return node.type && SUPPORTED_TYPES.has(node.type) ? node : null;
  }, [nodes, inlineParametersEnabled]);

  // Cost summary for the run section. External generation nodes use their
  // selected model; unavailable provider pricing is intentionally omitted.
  const runSummary = useMemo(() => {
    if (!selectedNode || !["nanoBanana", "generateVideo", "generate3d", "generateAudio"].includes(selectedNode.type ?? "")) return null;
    const data = selectedNode.data as NanoBananaNodeData | ExternalGenerationNodeData;
    const runs = selectedNode.type === "nanoBanana" ? (data as NanoBananaNodeData).runs ?? 1 : 1;
    const model = selectedNode.type === "nanoBanana"
      ? ((data as NanoBananaNodeData).selectedModel?.modelId || (data as NanoBananaNodeData).model)
      : (data as ExternalGenerationNodeData).selectedModel?.modelId;

    if (!model) return null;

    try {
      // The current local price table has image-generation prices only. Calling
      // it for an external model is safe, and returns no summary when pricing is
      // not yet available for that provider/model.
      const resolution = selectedNode.type === "nanoBanana" ? (data as NanoBananaNodeData).resolution : "1K";
      const perRun = calculateGenerationCost(model as NanoBananaNodeData["model"], resolution);
      return { runs, perRun, total: perRun * runs };
    } catch {
      return null;
    }
  }, [selectedNode]);

  return (
    <aside
      className={`fixed right-0 top-0 bottom-0 z-30 w-[240px] bg-[#17171a]/95 backdrop-blur-md border-l border-neutral-800 flex flex-col transition-transform duration-200 ${
        selectedNode ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!selectedNode}
    >
      {selectedNode && (
        <>
          <div className="flex items-center gap-2 px-3 pt-14 pb-3 border-b border-neutral-800">
            <HandleTypeIcon type={nodeTypeToIconType(selectedNode.type ?? "")} size={13} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-neutral-100 truncate">
                {(selectedNode.data as { customTitle?: string }).customTitle ||
                  getNodeTitle(selectedNode.type, t)}
              </div>
              <div className="text-[10px] text-neutral-500">{t("settingsPanel.nodeSettings")}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
              {selectedNode.type === "nanoBanana" ? (
                <GenerateImageSettings node={selectedNode} />
              ) : selectedNode.type === "generateVideo" ? (
                <GenerateVideoSettings node={selectedNode} />
              ) : selectedNode.type === "generate3d" ? (
                <Generate3DSettings node={selectedNode} />
              ) : selectedNode.type === "generateAudio" ? (
                <GenerateAudioSettings node={selectedNode} />
              ) : (
                <LLMSettings node={selectedNode} />
              )}
            </div>

            {/* Run selected nodes (Weavy right-panel parity) */}
            <div className="border-t border-neutral-800 p-3 space-y-2">
              {runSummary && (
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>
                    {runSummary.runs === 1
                      ? t("settingsPanel.runUnit1", { unit: formatCost(runSummary.perRun) })
                      : t("settingsPanel.runUnitN", { runs: runSummary.runs, unit: formatCost(runSummary.perRun) })}
                  </span>
                  <span className="text-neutral-200 font-medium tabular-nums">
                    {formatCost(runSummary.total)}
                  </span>
                </div>
              )}
              <button
                onClick={() => regenerateNode(selectedNode.id)}
                disabled={isRunning}
                className="w-full py-1.5 text-sm font-medium bg-neutral-100 text-neutral-900 rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRunning ? t("settingsPanel.running") : t("settingsPanel.runSelected")}
              </button>
            </div>
        </>
      )}
    </aside>
  );
}
