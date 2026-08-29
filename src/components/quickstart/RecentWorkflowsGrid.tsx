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

interface RecentWorkflowsGridProps {
  onWorkflowLoaded: (workflow: WorkflowFile, directoryPath: string) => void;
}

export function RecentWorkflowsGrid({ onWorkflowLoaded }: RecentWorkflowsGridProps) {
  const t = useT();
  const [dir, setDir] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<RecentWorkflowEntry[]>([]);
  const [query, setQuery] = useState("");
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

  return (
    <section>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {t("qs.myFiles")}
        </h2>
        {dir && workflows.length > 0 && (
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
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {visible.map((w) => (
            <button
              key={w.directoryPath}
              onClick={() => openWorkflow(w)}
              disabled={loadingPath !== null}
              className="group text-left rounded-lg border border-neutral-700/50 hover:border-neutral-600 hover:bg-neutral-800/40 transition-all overflow-hidden disabled:opacity-50"
            >
              <div className="h-16 bg-neutral-900/70 flex items-center justify-center">
                {loadingPath === w.directoryPath ? (
                  <span className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-300 rounded-full animate-spin" />
                ) : (
                  <svg
                    className="w-6 h-6 text-neutral-600 group-hover:text-neutral-400 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3"
                    />
                  </svg>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-neutral-200 truncate">{w.name}</p>
                <p className="text-[10px] text-neutral-500 truncate">
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
