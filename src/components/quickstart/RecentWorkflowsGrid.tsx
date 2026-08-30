"use client";

import { useState, useEffect, useCallback } from "react";
import { WorkflowFile } from "@/store/workflowStore";
import { useT } from "@/i18n";
import { formatRelativeTime } from "@/utils/relativeTime";
import { getWorkflowsDirectory, setWorkflowsDirectory } from "@/store/utils/localStorage";

export interface RecentWorkflowEntry {
  name: string;
  directoryPath: string;
  relativePath: string;
  lastModified: number;
}

/** Case-insensitive filter over workflow name and folder name. */
export function filterRecentWorkflows(
  workflows: RecentWorkflowEntry[],
  query: string
): RecentWorkflowEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return workflows;
  return workflows.filter((w) => {
    const dirName = w.directoryPath.split("/").filter(Boolean).pop() || "";
    return w.name.toLowerCase().includes(q) || dirName.toLowerCase().includes(q);
  });
}

/**
 * Deterministic 0..1 pseudo-random values from a string, used to vary the
 * placeholder node-graph motif per workflow so cards look distinct.
 */
function seededScalars(seed: string, count: number): number[] {
  let h = 2166136261;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    for (const c of seed + i) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    out.push(((h >>> 0) % 1000) / 1000);
  }
  return out;
}

/**
 * Stylized node-graph motif standing in for a canvas thumbnail (Weavy shows
 * real canvas previews; workflow JSONs are only read on demand, so the list
 * view uses this lightweight placeholder instead).
 */
function WorkflowMotif({ seed }: { seed: string }) {
  const [a, b, c] = seededScalars(seed, 3);
  const x1 = 18 + a * 10;
  const y1 = 22 + b * 16;
  const x2 = 52 + b * 12;
  const y2 = 46 + c * 14;
  const x3 = 30 + c * 20;
  const y3 = 74 + a * 12;
  return (
    <svg
      viewBox="0 0 120 110"
      className="w-full h-full text-neutral-700 group-hover:text-neutral-500 transition-colors duration-300"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={`M ${x1 + 26} ${y1 + 12} C ${x1 + 44} ${y1 + 12}, ${x2 - 18} ${y2 + 10}, ${x2} ${y2 + 10}`}
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.7"
      />
      <path
        d={`M ${x2 + 12} ${y2 + 22} C ${x2 + 12} ${y2 + 40}, ${x3 + 26} ${y3 - 16}, ${x3 + 26} ${y3}`}
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.7"
      />
      <rect x={x1} y={y1} width="26" height="24" rx="4" fill="currentColor" opacity="0.45" />
      <rect x={x2} y={y2} width="34" height="22" rx="4" fill="currentColor" opacity="0.3" />
      <rect x={x3} y={y3} width="26" height="20" rx="4" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

type ViewMode = "grid" | "list";

interface RecentWorkflowsGridProps {
  onWorkflowLoaded: (workflow: WorkflowFile, directoryPath: string) => void;
}

export function RecentWorkflowsGrid({ onWorkflowLoaded }: RecentWorkflowsGridProps) {
  const t = useT();
  const [dir, setDir] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<RecentWorkflowEntry[]>([]);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // localStorage is only safe to read after mount (SSR hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDir(getWorkflowsDirectory());
  }, []);

  useEffect(() => {
    if (!dir) return;
    let cancelled = false;
    // Setting loading state before the fetch awaits is the same pattern as
    // WorkflowBrowserView: genuinely reacting to dir becoming available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);
    fetch(`/api/list-workflows?path=${encodeURIComponent(dir)}`)
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          const sorted = [...(result.workflows as RecentWorkflowEntry[])].sort(
            (a, b) => b.lastModified - a.lastModified
          );
          setWorkflows(sorted);
        } else {
          setError(result.error || t("browser.errListFailed"));
        }
      })
      .catch(() => {
        if (!cancelled) setError(t("browser.errFetchFailed"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dir, t]);

  const chooseFolder = useCallback(async () => {
    try {
      const res = await fetch("/api/browse-directory");
      const result = await res.json();
      if (result.success && !result.cancelled && result.path) {
        setWorkflowsDirectory(result.path);
        setDir(result.path);
      }
    } catch {
      setError(t("browser.errPickerFailed"));
    }
  }, [t]);

  const openWorkflow = useCallback(
    async (entry: RecentWorkflowEntry) => {
      setLoadingPath(entry.directoryPath);
      setError(null);
      try {
        const res = await fetch(
          `/api/workflow?path=${encodeURIComponent(entry.directoryPath)}&load=true`
        );
        const result = await res.json();
        if (!result.success) {
          setError(result.error || t("browser.errLoadFailed"));
          return;
        }
        onWorkflowLoaded(result.workflow as WorkflowFile, entry.directoryPath);
      } catch {
        setError(t("browser.errLoadFailed"));
      } finally {
        setLoadingPath(null);
      }
    },
    [onWorkflowLoaded, t]
  );

  const visible = filterRecentWorkflows(workflows, query).slice(0, 6);
  const hasList = dir !== null && workflows.length > 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {t("qs.myFiles")}
        </h2>
        {hasList && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg
                className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("qs.searchWorkflows")}
                className="w-44 pl-7 pr-2.5 py-1.5 text-xs rounded-md bg-neutral-900/60 border border-neutral-700/60 text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500"
              />
            </div>
            {/* Grid / list toggle, mirroring Weavy's My files toolbar */}
            <div className="flex rounded-md border border-neutral-700/60 overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                aria-label={t("qs.viewList")}
                aria-pressed={viewMode === "list"}
                className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-neutral-700 text-neutral-200" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                aria-label={t("qs.viewGrid")}
                aria-pressed={viewMode === "grid"}
                className={`p-1.5 transition-colors ${viewMode === "grid" ? "bg-neutral-700 text-neutral-200" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 18v-2.25A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {dir === null ? (
        <button
          onClick={chooseFolder}
          className="w-full p-3 rounded-lg border border-dashed border-neutral-700 text-xs text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors"
        >
          {t("qs.chooseFolder")}
        </button>
      ) : error ? (
        <p className="text-xs text-red-400 py-2">{error}</p>
      ) : isLoading ? (
        <p className="text-xs text-neutral-500 py-2">{t("qs.loadingWorkflows")}</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-neutral-500 py-2">{t("qs.noRecentWorkflows")}</p>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-3 gap-3">
          {visible.map((w) => (
            <button
              key={w.directoryPath}
              onClick={() => openWorkflow(w)}
              disabled={loadingPath !== null}
              className="group text-left rounded-xl overflow-hidden border border-neutral-700/50 bg-neutral-900/40 hover:border-neutral-500 hover:bg-neutral-800/50 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
            >
              <div className="aspect-[4/3] bg-neutral-900/80 flex items-center justify-center p-4">
                {loadingPath === w.directoryPath ? (
                  <span className="w-5 h-5 border-2 border-neutral-600 border-t-neutral-300 rounded-full animate-spin" />
                ) : (
                  <WorkflowMotif seed={w.directoryPath} />
                )}
              </div>
              <div className="px-3 py-2.5">
                <p className="text-sm font-medium text-neutral-100 truncate">{w.name}</p>
                <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                  {t("qs.lastEdited")} {formatRelativeTime(w.lastModified)}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((w) => (
            <button
              key={w.directoryPath}
              onClick={() => openWorkflow(w)}
              disabled={loadingPath !== null}
              className="group flex items-center gap-3 text-left rounded-lg px-3 py-2 border border-transparent hover:border-neutral-700 hover:bg-neutral-800/50 transition-all disabled:opacity-50"
            >
              <div className="w-12 h-9 rounded-md bg-neutral-900/80 border border-neutral-800 flex items-center justify-center overflow-hidden flex-shrink-0 p-1">
                {loadingPath === w.directoryPath ? (
                  <span className="w-3.5 h-3.5 border-2 border-neutral-600 border-t-neutral-300 rounded-full animate-spin" />
                ) : (
                  <WorkflowMotif seed={w.directoryPath} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-100 truncate">{w.name}</p>
                <p className="text-[11px] text-neutral-500 truncate">
                  {t("qs.lastEdited")} {formatRelativeTime(w.lastModified)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

