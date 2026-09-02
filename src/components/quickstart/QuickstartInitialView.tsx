"use client";

import Image from "next/image";
import { useT } from "@/i18n";
import { WorkflowFile } from "@/store/workflowStore";
import { TemplateStrip } from "./TemplateStrip";
import { RecentWorkflowsGrid } from "./RecentWorkflowsGrid";

interface QuickstartInitialViewProps {
  onNewProject: () => void;
  onSelectTemplates: () => void;
  onSelectVibe: () => void;
  onSelectLoad: () => void;
  onWorkflowLoaded: (workflow: WorkflowFile, directoryPath?: string) => void;
}

/**
 * Weavy-style dashboard home: prominent create action on top, a workflow
 * library poster strip, and the user's recent files with search — instead of
 * a bare menu of four option buttons.
 */
export function QuickstartInitialView({
  onNewProject,
  onSelectTemplates,
  onSelectVibe,
  onSelectLoad,
  onWorkflowLoaded,
}: QuickstartInitialViewProps) {
  const t = useT();
  return (
    <div className="p-8 overflow-y-auto">
      {/* Header: brand + primary create actions */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Image src="/banana_icon.png" alt="" width={28} height={28} className="w-7 h-7" />
            <h1 className="text-2xl font-medium text-neutral-100">Node Banana</h1>
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed max-w-md">
            {t("qs.tagline")}
          </p>
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={onNewProject}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-100 text-neutral-900 text-sm font-medium hover:bg-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t("qs.newProject")}
          </button>
          <button
            onClick={onSelectVibe}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:border-neutral-500 hover:text-neutral-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09L18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
            {t("qs.promptWorkflow")}
            <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded bg-blue-500/20 text-blue-400">
              Beta
            </span>
          </button>
        </div>
      </div>

      {/* Workflow library poster strip */}
      <div className="mb-6">
        <TemplateStrip
          onWorkflowSelected={(workflow) => onWorkflowLoaded(workflow)}
          onBrowseAll={onSelectTemplates}
        />
      </div>

      {/* Recent files with search */}
      <div className="mb-6">
        <RecentWorkflowsGrid onWorkflowLoaded={onWorkflowLoaded} />
      </div>

      {/* Footer: secondary actions + links */}
      <div className="flex items-center justify-between border-t border-neutral-700/60 pt-4">
        <button
          onClick={onSelectLoad}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          {t("qs.loadWorkflow")}…
        </button>
        <div className="flex items-center gap-4">
          <a
            href="https://node-banana-docs.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Docs
          </a>
          <a
            href="https://discord.com/invite/89Nr6EKkTf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Discord
          </a>
          <a
            href="https://x.com/ReflctWillie"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Willie
          </a>
          <a
            href="https://nodebananapro.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            NB Pro Waitlist
          </a>
        </div>
      </div>
    </div>
  );
}

