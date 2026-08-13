/**
 * LibraryPanel — Weavy-parity left slide-in panel (240px).
 *
 * Tabs:
 *  - Nodes: same category data as NodePickerMenu / FloatingActionBar.
 *    Click adds at viewport center; drag onto canvas to place.
 *  - Presets: saved node/group presets (populated from localStorage).
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { NodeType, ProviderType } from "@/types";
import { useWorkflowStore } from "@/store/workflowStore";
import { usePanelStore } from "@/store/panelStore";
import { ALL_NODES_CATEGORIES } from "./FloatingActionBar";
import { HandleTypeIcon, nodeTypeToIconType } from "./nodes/HandleTypeIcon";
import { loadPresets, applyPreset, deletePreset, WorkflowPreset } from "@/utils/presets";
import { loadHistory, restoreSnapshot, deleteSnapshot, VersionSnapshot } from "@/utils/versionHistory";
import { useT, nodeCategoryKey } from "@/i18n";

type Tab = "nodes" | "presets" | "history" | "models";

type LibraryModel = {
  id: string;
  name: string;
  provider: ProviderType;
  capabilities: string[];
  coverImage?: string;
  description?: string;
};

type ModelCategory = {
  label: "Image" | "Video" | "3D" | "Audio";
  iconType: "image" | "video" | "3d" | "audio";
  nodeType: Extract<NodeType, "nanoBanana" | "generateVideo" | "generate3d" | "generateAudio">;
  capabilities: string[];
};

const MODEL_CATEGORIES: ModelCategory[] = [
  { label: "Image", iconType: "image", nodeType: "nanoBanana", capabilities: ["text-to-image", "image-to-image"] },
  { label: "Video", iconType: "video", nodeType: "generateVideo", capabilities: ["text-to-video", "image-to-video"] },
  { label: "3D", iconType: "3d", nodeType: "generate3d", capabilities: ["text-to-3d", "image-to-3d"] },
  { label: "Audio", iconType: "audio", nodeType: "generateAudio", capabilities: ["text-to-audio", "audio-to-video"] },
];

export function LibraryPanel() {
  const t = useT();
  const libraryOpen = usePanelStore((state) => state.libraryOpen);
  const libraryFilter = usePanelStore((state) => state.libraryFilter);
  const setLibraryFilter = usePanelStore((state) => state.setLibraryFilter);
  const searchFocusToken = usePanelStore((state) => state.librarySearchFocusToken);
  const [tab, setTab] = useState<Tab>("nodes");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [presets, setPresets] = useState<WorkflowPreset[]>([]);
  const [history, setHistory] = useState<VersionSnapshot[]>([]);
  const [models, setModels] = useState<LibraryModel[] | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const addNode = useWorkflowStore((state) => state.addNode);
  const { screenToFlowPosition } = useReactFlow();

  // Focus the search box when requested from the icon rail
  useEffect(() => {
    if (searchFocusToken > 0) {
      setTab("nodes");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [searchFocusToken]);

  // Refresh presets/history whenever the panel opens or the tab is selected
  useEffect(() => {
    if (!libraryOpen) return;
    if (tab === "presets") setPresets(loadPresets());
    if (tab === "history") setHistory(loadHistory());
  }, [libraryOpen, tab]);

  // Load the provider catalogue only when the Models tab is first opened.
  useEffect(() => {
    if (!libraryOpen || tab !== "models" || models !== null) return;

    let cancelled = false;
    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        let settings: { providers?: Record<string, { apiKey?: string | null }> } | null = null;
        const settingsJson = localStorage.getItem("node-banana-provider-settings");
        if (settingsJson) {
          try {
            settings = JSON.parse(settingsJson);
          } catch {
            // A malformed saved settings value should not prevent the Gemini catalogue loading.
          }
        }

        const headers: Record<string, string> = {};
        if (settings?.providers?.kie?.apiKey) headers["X-Kie-Key"] = settings.providers.kie.apiKey;
        if (settings?.providers?.fal?.apiKey) headers["X-Fal-Key"] = settings.providers.fal.apiKey;
        if (settings?.providers?.replicate?.apiKey) headers["X-Replicate-Key"] = settings.providers.replicate.apiKey;
        if (settings?.providers?.wavespeed?.apiKey) headers["X-WaveSpeed-Key"] = settings.providers.wavespeed.apiKey;

        const response = await fetch("/api/models", { headers });
        const data: { success?: boolean; models?: LibraryModel[] } = await response.json();
        if (!cancelled) setModels(response.ok && data.success && Array.isArray(data.models) ? data.models : []);
      } catch {
        if (!cancelled) setModels([]);
      } finally {
        if (!cancelled) setIsLoadingModels(false);
      }
    };

    fetchModels();
    return () => {
      cancelled = true;
    };
  }, [libraryOpen, models, tab]);

  const handleAddNode = useCallback(
    (type: NodeType) => {
      const pane = document.querySelector(".react-flow");
      const rect = pane?.getBoundingClientRect();
      const center = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      addNode(type, screenToFlowPosition(center));
    },
    [addNode, screenToFlowPosition]
  );

  const handleDragStart = useCallback((event: React.DragEvent, type: NodeType) => {
    event.dataTransfer.setData("application/node-type", type);
    event.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleAddModel = useCallback(
    (model: LibraryModel, category: ModelCategory) => {
      const pane = document.querySelector(".react-flow");
      const rect = pane?.getBoundingClientRect();
      const center = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      addNode(category.nodeType, screenToFlowPosition(center), {
        selectedModel: {
          provider: model.provider,
          modelId: model.id,
          displayName: model.name,
        },
      });
    },
    [addNode, screenToFlowPosition]
  );

  // Visible categories after icon-rail filter + search query
  const visibleCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ALL_NODES_CATEGORIES.map((category) => ({
      ...category,
      nodes: category.nodes.filter((node) => {
        if (libraryFilter && nodeTypeToIconType(node.type) !== libraryFilter) return false;
        if (query && !node.label.toLowerCase().includes(query)) return false;
        return true;
      }),
    })).filter((category) => category.nodes.length > 0);
  }, [libraryFilter, search]);

  const visibleModelCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return MODEL_CATEGORIES.map((category) => ({
      ...category,
      models: (models ?? []).filter((model) => {
        if (libraryFilter && category.iconType !== libraryFilter) return false;
        if (!model.capabilities.some((capability) => category.capabilities.includes(capability))) return false;
        return !query || model.name.toLowerCase().includes(query);
      }),
    })).filter((category) => category.models.length > 0);
  }, [libraryFilter, models, search]);

  return (
    <aside
      className={`fixed left-14 top-0 bottom-0 z-30 w-[240px] bg-[#17171a]/95 backdrop-blur-md border-r border-neutral-800 flex flex-col transition-transform duration-200 ${
        libraryOpen ? "translate-x-0" : "-translate-x-[calc(100%+56px)]"
      }`}
      aria-hidden={!libraryOpen}
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("library.searchPlaceholder")}
          className="w-full bg-neutral-800/70 text-sm text-neutral-100 placeholder:text-neutral-500 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-neutral-500"
        />
      </div>

      {/* Active filter chip */}
      {libraryFilter && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setLibraryFilter(null)}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] bg-neutral-700/60 text-neutral-200 rounded hover:bg-neutral-700 transition-colors"
          >
            <HandleTypeIcon type={libraryFilter} size={10} />
            {t(`iconRail.${libraryFilter === "3d" ? "3d" : libraryFilter}Nodes`)}
            <span className="text-neutral-400">×</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-neutral-800">
        {(["nodes", "models", "presets", "history"] as Tab[]).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
              tab === tabId
                ? "bg-neutral-700/70 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {tabId === "nodes"
              ? t("library.tabNodes")
              : tabId === "models"
                ? t("library.tabModels")
                : tabId === "presets"
                  ? t("library.tabPresets")
                  : t("library.tabHistory")}
          </button>
        ))}
      </div>

      {tab === "nodes" ? (
        <div className="flex-1 overflow-y-auto py-2">
          {visibleCategories.length === 0 && (
            <div className="px-4 py-8 text-xs text-neutral-500 text-center">{t("library.noMatches")}</div>
          )}
          {visibleCategories.map((category) => (
            <div key={category.label} className="mb-1">
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {t(nodeCategoryKey(category.label))}
              </div>
              {/* Weavy tile grid: 3 columns of square tiles, centered white */}
              {/* glyph with label underneath (see screenshots/02-toolbox-panel) */}
              <div className="grid grid-cols-3 gap-1.5 px-3 pb-2">
                {category.nodes.map((node) => (
                  <button
                    key={node.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, node.type)}
                    onClick={() => handleAddNode(node.type)}
                    title={t(`nodeType.${node.type}`)}
                    className="flex flex-col items-center justify-center gap-1 aspect-square bg-[#212126] hover:bg-[#2a2a31] rounded-lg border border-neutral-700/40 hover:border-neutral-600 transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <HandleTypeIcon type={nodeTypeToIconType(node.type)} color="#e5e5e5" size={18} />
                    <span className="text-[9px] leading-tight text-neutral-400 text-center px-1 line-clamp-2">
                      {t(`nodeType.${node.type}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : tab === "models" ? (
        <div className="flex-1 overflow-y-auto py-2">
          {isLoadingModels || models === null ? (
            <div className="px-4 py-8 flex flex-col items-center gap-2 text-xs text-neutral-500">
              <span className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-200 rounded-full animate-spin" />
              {t("library.loadingModels")}
            </div>
          ) : models?.length === 0 ? (
            <div className="px-4 py-8 text-xs text-neutral-500 text-center leading-relaxed">
              {t("library.noModelsConfigured")}
            </div>
          ) : (
            <>
              <div className="px-3 pt-1 pb-2 text-[10px] text-neutral-500">
                {t("library.modelCount", { count: models?.length ?? 0 })}
              </div>
              {visibleModelCategories.length === 0 && (
                <div className="px-4 py-8 text-xs text-neutral-500 text-center">{t("library.noMatches")}</div>
              )}
              {visibleModelCategories.map((category) => (
                <div key={category.label} className="mb-1">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    {category.label}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 px-3 pb-2">
                    {category.models.map((model) => (
                      <button
                        key={`${category.label}-${model.provider}-${model.id}`}
                        onClick={() => handleAddModel(model, category)}
                        title={model.description || model.name}
                        className="flex flex-col items-center justify-center gap-1 aspect-square bg-[#212126] hover:bg-[#2a2a31] rounded-lg border border-neutral-700/40 hover:border-neutral-600 transition-colors"
                      >
                        <HandleTypeIcon type={category.iconType} color="#e5e5e5" size={18} />
                        <span className="text-[9px] leading-tight text-neutral-300 text-center px-1 line-clamp-2">
                          {model.name}
                        </span>
                        <span className="text-[8px] leading-none uppercase text-neutral-500">{model.provider}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : tab === "presets" ? (
        <div className="flex-1 overflow-y-auto py-2">
          {presets.length === 0 ? (
            <div className="px-4 py-8 text-xs text-neutral-500 text-center leading-relaxed">
              {t("library.noPresets")}
              <br />
              {t("library.noPresetsHint")}
            </div>
          ) : (
            presets.map((preset) => (
              <div
                key={preset.id}
                className="group flex items-center gap-2 px-3 py-2 hover:bg-neutral-700/40 transition-colors"
              >
                <button
                  onClick={() => {
                    applyPreset(preset);
                  }}
                  className="flex-1 min-w-0 text-left"
                  title={t("library.insertPreset", { count: preset.nodes.length })}
                >
                  <div className="text-sm text-neutral-200 truncate">{preset.name}</div>
                  <div className="text-[10px] text-neutral-500">
                    {preset.nodes.length === 1
                      ? t("library.presetNode", { count: preset.nodes.length })
                      : t("library.presetNodes", { count: preset.nodes.length })}
                  </div>
                </button>
                <button
                  onClick={() => {
                    deletePreset(preset.id);
                    setPresets(loadPresets());
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-red-400 transition-all"
                  title={t("library.deletePreset")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-2">
          {history.length === 0 ? (
            <div className="px-4 py-8 text-xs text-neutral-500 text-center leading-relaxed">
              {t("library.noHistory")}
              <br />
              {t("library.noHistoryHint")}
            </div>
          ) : (
            history.map((snapshot) => (
              <div
                key={snapshot.id}
                className="group flex items-center gap-2 px-3 py-2 hover:bg-neutral-700/40 transition-colors"
              >
                <button
                  onClick={() => {
                    if (window.confirm(t("library.restoreConfirm"))) {
                      restoreSnapshot(snapshot.id);
                    }
                  }}
                  className="flex-1 min-w-0 text-left"
                  title={t("library.restoreSnapshot")}
                >
                  <div className="text-sm text-neutral-200 truncate">
                    {new Date(snapshot.at).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {t("library.snapshotStats", { nodes: snapshot.nodeCount, edges: snapshot.edgeCount })}
                  </div>
                </button>
                <button
                  onClick={() => {
                    deleteSnapshot(snapshot.id);
                    setHistory(loadHistory());
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-red-400 transition-all"
                  title={t("library.deleteSnapshot")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
          <div className="px-4 py-3 text-[10px] text-neutral-600 leading-relaxed border-t border-neutral-800 mt-2">
            {t("library.historyNote")}
          </div>
        </div>
      )}
    </aside>
  );
}
