/**
 * TasksPanel — local task list (Weavy "Tasks" parity, adapted for local
 * BYOK execution). Shows currently running node executions and recent
 * completions/errors from node statuses.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useWorkflowStore } from "@/store/workflowStore";
import { HandleTypeIcon, nodeTypeToIconType } from "./nodes/HandleTypeIcon";
import { useT } from "@/i18n";
import { useToast } from "./Toast";

export function TasksPanel() {
  const t = useT();
  const STATUS_LABEL: Record<string, string> = {
    loading: t("tasks.running"),
    complete: t("tasks.complete"),
    error: t("tasks.error"),
    skipped: t("tasks.skipped"),
  };
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // `?? []` keeps the panel safe in tests that mock the store with partial state
  const nodes = useWorkflowStore(useShallow((state) => state.nodes));
  const isRunning = useWorkflowStore((state) => state.isRunning);

  // Track previous task statuses to detect completion transitions
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const toast = useToast((s) => s.show);

  const tasks = useMemo(() => {
    const interesting = (nodes ?? []).filter((n) => {
      const status = (n.data as { status?: string }).status;
      return status === "loading" || status === "complete" || status === "error";
    });
    const rank = (s: string) => (s === "loading" ? 0 : s === "error" ? 1 : 2);
    return interesting
      .map((n) => ({
        id: n.id,
        type: n.type ?? "",
        title:
          (n.data as { customTitle?: string }).customTitle ||
          (n.data as { label?: string }).label ||
          n.type ||
          n.id,
        status: (n.data as { status?: string }).status ?? "idle",
        error: (n.data as { error?: string | null }).error ?? null,
      }))
      .sort((a, b) => rank(a.status) - rank(b.status))
      .slice(0, 12);
  }, [nodes]);

  const runningCount = tasks.filter((t) => t.status === "loading").length;

  // Show toast when a task transitions from "loading" to "complete" or "error"
  useEffect(() => {
    const prev = prevStatusRef.current;
    for (const task of tasks) {
      const oldStatus = prev.get(task.id);
      if (oldStatus === "loading" && task.status === "complete") {
        toast(`${task.title} — ${t("tasks.complete")}`, "success");
      } else if (oldStatus === "loading" && task.status === "error") {
        toast(`${task.title} — ${t("tasks.error")}`, "error");
      }
    }
    // Update refs for next render
    const next = new Map<string, string>();
    for (const task of tasks) {
      next.set(task.id, task.status);
    }
    prevStatusRef.current = next;
  }, [tasks, toast, t]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative px-2 py-1 text-xs font-medium rounded transition-colors ${
          open ? "bg-neutral-700 text-neutral-100" : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700/60"
        }`}
        title={t("tasks.title")}
      >
        {t("tasks.title")}
        {(runningCount > 0 || isRunning) && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[9px] font-semibold text-neutral-900 bg-neutral-100 rounded-full">
            {runningCount || "…"}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-[#1b1b1f] border border-neutral-700/60 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
            {t("tasks.title")}
          </div>
          <div className="max-h-[300px] overflow-y-auto py-1">
            {tasks.length === 0 ? (
              <div className="px-3 py-6 text-xs text-neutral-500 text-center">
                {t("tasks.empty")}
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 px-3 py-1.5">
                  <HandleTypeIcon type={nodeTypeToIconType(task.type)} size={11} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-neutral-200 truncate">{task.title}</div>
                    {task.error && (
                      <div className="text-[10px] text-red-400 truncate" title={task.error}>
                        {task.error}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium shrink-0 ${
                      task.status === "loading"
                        ? "text-blue-300"
                        : task.status === "error"
                        ? "text-red-400"
                        : "text-neutral-500"
                    }`}
                  >
                    {task.status === "loading" && (
                      <svg className="inline w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {STATUS_LABEL[task.status]}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
