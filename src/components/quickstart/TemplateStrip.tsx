"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { WorkflowFile } from "@/store/workflowStore";
import { getAllPresets } from "@/lib/quickstart/templates";
import { primaryThumbnails } from "@/lib/quickstart/templateThumbnails";
import { useT } from "@/i18n";

// Static preset list (getAllPresets is pure/deterministic) — hoisted so its
// identity is stable across renders.
const PRESETS = getAllPresets();

interface TemplateStripProps {
  onWorkflowSelected: (workflow: WorkflowFile) => void;
  onBrowseAll: () => void;
}

/** Weavy-style horizontal strip of template poster cards. */
export function TemplateStrip({ onWorkflowSelected, onBrowseAll }: TemplateStripProps) {
  const t = useT();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectPreset = useCallback(
    async (templateId: string) => {
      setLoadingId(templateId);
      setError(null);
      try {
        const response = await fetch("/api/quickstart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, contentLevel: "full" }),
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || t("tpl.errLoadTemplate"));
        }
        if (result.workflow) {
          onWorkflowSelected(result.workflow);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("tpl.errLoadTemplate"));
      } finally {
        setLoadingId(null);
      }
    },
    [onWorkflowSelected, t]
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {t("qs.workflowLibrary")}
        </h2>
        <button
          onClick={onBrowseAll}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          {t("qs.browseAll")} →
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {PRESETS.map((preset) => {
          const thumb = primaryThumbnails[preset.id];
          const isLoading = loadingId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => selectPreset(preset.id)}
              disabled={loadingId !== null}
              className="group relative flex-shrink-0 w-36 h-24 rounded-lg overflow-hidden border border-neutral-700/50 hover:border-neutral-500 transition-all disabled:opacity-50"
              title={preset.description}
            >
              {thumb ? (
                <Image
                  src={thumb}
                  alt=""
                  fill
                  sizes="144px"
                  className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
              ) : (
                <div className="absolute inset-0 bg-neutral-700/40" />
              )}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="w-4 h-4 border-2 border-neutral-500 border-t-neutral-200 rounded-full animate-spin" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-[11px] font-medium text-neutral-100 truncate text-left">
                  {preset.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

