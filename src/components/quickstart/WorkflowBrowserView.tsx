"use client";

import { useState, useEffect, useCallback } from "react";
import { WorkflowFile } from "@/store/workflowStore";
import { QuickstartBackButton } from "./QuickstartBackButton";
import { useT } from "@/i18n";
import { formatRelativeTime } from "@/utils/relativeTime";
import {
  getWorkflowsDirectory,
  setWorkflowsDirectory,
} from "@/store/utils/localStorage";

interface WorkflowListEntry {
  name: string;
  directoryPath: string;
  relativePath: string;
  lastModified: number;
}

interface WorkflowBrowserViewProps {
  onBack?: () => void;
  onWorkflowLoaded: (workflow: WorkflowFile, directoryPath: string) => void;
  onClose?: () => void;
}

export function dirBasename(dirPath: string): string {
  return dirPath.split("/").filter(Boolean).pop() || dirPath;
}

export function WorkflowBrowserView({
  onBack,
  onWorkflowLoaded,
  onClose,
}: WorkflowBrowserViewProps) {
  const t = useT();
  const [defaultDir, setDefaultDir] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingWorkflow, setLoadingWorkflow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Deferred to an effect (not a lazy useState initializer) for SSR
    // hydration safety: reading localStorage during the initial client
    // render, before hydration completes, would mismatch the server's null.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDefaultDir(getWorkflowsDirectory());
  }, []);

  const fetchWorkflows = useCallback(async (dirPath: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/list-workflows?path=${encodeURIComponent(dirPath)}`
      );
      const result = await res.json();
      if (result.success) {
        setWorkflows(result.workflows);
        if (result.workflows.length === 0) {
          setError(t("browser.errNoWorkflows"));
        }
      } else {
        setError(result.error || t("browser.errListFailed"));
      }
    } catch {
      setError(t("browser.errFetchFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (defaultDir) {
      // fetchWorkflows synchronously sets isLoading/error before its await;
      // genuinely reacting to defaultDir becoming available, not a
      // derivable-state case worth restructuring.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchWorkflows(defaultDir);
    }
  }, [defaultDir, fetchWorkflows]);

  const browseAndSetDir = useCallback(async () => {
    try {
      const res = await fetch("/api/browse-directory");
      const result = await res.json();
      if (result.success && !result.cancelled && result.path) {
        setWorkflowsDirectory(result.path);
        setDefaultDir(result.path);
      }
    } catch {
      setError(t("browser.errPickerFailed"));
    }
  }, [t]);

  const handleBrowseOther = useCallback(async () => {
    try {
      const browseRes = await fetch("/api/browse-directory");
      const browseResult = await browseRes.json();

      if (
        !browseResult.success ||
        browseResult.cancelled ||
        !browseResult.path
      ) {
        if (!browseResult.success && !browseResult.cancelled) {
          setError(browseResult.error || t("browser.errPickerFailed"));
        }
        return;
      }

      const dirPath = browseResult.path;

      setLoadingWorkflow(dirPath);
      const loadRes = await fetch(
        `/api/workflow?path=${encodeURIComponent(dirPath)}&load=true`
      );
      const loadResult = await loadRes.json();
      setLoadingWorkflow(null);

      if (!loadResult.success) {
        setError(loadResult.error || t("browser.errNoFile"));
        return;
      }

      onWorkflowLoaded(loadResult.workflow as WorkflowFile, dirPath);
      onClose?.();
    } catch {
      setLoadingWorkflow(null);
      setError(t("browser.errOpenFailed"));
    }
  }, [onWorkflowLoaded, onClose, t]);

  const handleSelectWorkflow = useCallback(
    async (entry: WorkflowListEntry) => {
      setLoadingWorkflow(entry.directoryPath);
      setError(null);
      try {
        const res = await fetch(
          `/api/workflow?path=${encodeURIComponent(entry.directoryPath)}&load=true`
        );
        const result = await res.json();

        if (!result.success) {
          setError(result.error || t("browser.errLoadFailed"));
          setLoadingWorkflow(null);
          return;
        }

        onWorkflowLoaded(
          result.workflow as WorkflowFile,
          entry.directoryPath
        );
        onClose?.();
      } catch {
        setError(t("browser.errLoadFailed"));
        setLoadingWorkflow(null);
      }
    },
    [onWorkflowLoaded, onClose, t]
  );

  // State A: No default directory configured
  if (defaultDir === null) {
    return (
      <div className="p-8 flex flex-col items-center">
        {onBack && (
          <div className="w-full mb-4">
            <QuickstartBackButton onClick={onBack} />
          </div>
        )}
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-neutral-700/50 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                />
              </svg>
            </div>
            <h2 id="workflow-browser-title" className="text-lg font-medium text-neutral-200">
              {t("browser.title")}
            </h2>
          </div>
          <p className="text-sm text-neutral-500 max-w-xs text-center">
            {t("browser.chooseFolderHint")}
          </p>
          <button
            onClick={browseAndSetDir}
            className="px-4 py-2 text-sm font-medium text-neutral-200 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition-colors"
          >
            {t("browser.chooseFolder")}
          </button>
        </div>
      </div>
    );
  }

  // State B: Default directory configured — show listing
  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-neutral-700/50 flex-shrink-0">
        {onBack && (
          <div className="mb-2">
            <QuickstartBackButton onClick={onBack} />
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium text-neutral-200">
            {t("browser.title")}
          </h2>
          <span className="text-xs text-neutral-600 tabular-nums flex-shrink-0">
            {t("browser.projectCount", { count: workflows.length })}
          </span>
        </div>
        <p
          className="text-xs text-neutral-500 truncate mt-0.5"
          title={defaultDir}
        >
          {defaultDir}
        </p>
      </div>

      {/* Workflow list */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-neutral-600 border-t-neutral-300 rounded-full animate-spin" />
          </div>
        ) : error && workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="w-10 h-10 text-neutral-700 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
            <p className="text-sm text-neutral-400 mb-1">{t("browser.noWorkflows")}</p>
            <p className="text-xs text-neutral-600">
              {t("browser.noWorkflowsHint")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {workflows.map((entry) => {
              const isActive = loadingWorkflow === entry.directoryPath;
              return (
                <button
                  key={entry.directoryPath}
                  onClick={() => handleSelectWorkflow(entry)}
                  disabled={loadingWorkflow !== null}
                  className={`
                    group text-left px-3 py-2.5 rounded-lg transition-all duration-100
                    disabled:opacity-50
                    ${isActive
                      ? "bg-neutral-700/60 border border-neutral-600"
                      : "border border-transparent hover:bg-neutral-700/30 hover:border-neutral-700/50"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {/* Folder icon */}
                    <div className={`
                      w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 transition-colors
                      ${isActive ? "bg-blue-500/20" : "bg-neutral-700/50 group-hover:bg-neutral-700"}
                    `}>
                      {isActive ? (
                        <div className="w-3.5 h-3.5 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
                      ) : (
                        <svg
                          className="w-4 h-4 text-neutral-400 group-hover:text-neutral-300 transition-colors"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Name + folder name */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-200 group-hover:text-neutral-100 transition-colors truncate">
                        {entry.name}
                      </div>
                      <div className="text-[11px] text-neutral-600 truncate">
                        {entry.relativePath || dirBasename(entry.directoryPath)}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <span className="text-[11px] text-neutral-600 tabular-nums flex-shrink-0">
                      {formatRelativeTime(entry.lastModified)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {error && workflows.length > 0 && (
          <p className="text-xs text-red-400 mt-2 px-3">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-neutral-700/50 flex-shrink-0 flex items-center justify-between">
        <button
          onClick={handleBrowseOther}
          disabled={loadingWorkflow !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-700/50 hover:bg-neutral-700 border border-neutral-600/50 hover:border-neutral-600 rounded-md transition-colors disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          {t("browser.openFromDirectory")}
        </button>
        <button
          onClick={browseAndSetDir}
          disabled={loadingWorkflow !== null}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
        >
          {t("browser.changeFolder")}
        </button>
      </div>
    </div>
  );
}
