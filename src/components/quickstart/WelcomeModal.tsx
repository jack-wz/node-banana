"use client";

import { useState, useCallback } from "react";
import { WorkflowFile } from "@/store/workflowStore";
import { QuickstartView } from "@/types/quickstart";
import { QuickstartInitialView } from "./QuickstartInitialView";
import { TemplateExplorerView } from "./TemplateExplorerView";
import { PromptWorkflowView } from "./PromptWorkflowView";
import { WorkflowBrowserView } from "./WorkflowBrowserView";

interface WelcomeModalProps {
  onWorkflowGenerated: (workflow: WorkflowFile, directoryPath?: string) => void;
  onClose: () => void;
  onNewProject: () => void;
}

export function WelcomeModal({
  onWorkflowGenerated,
  onClose,
  onNewProject,
}: WelcomeModalProps) {
  const [currentView, setCurrentView] = useState<QuickstartView>("initial");

  const handleNewProject = useCallback(() => {
    onNewProject();
  }, [onNewProject]);

  const handleSelectTemplates = useCallback(() => {
    setCurrentView("templates");
  }, []);

  const handleSelectVibe = useCallback(() => {
    setCurrentView("vibe");
  }, []);

  const handleSelectLoad = useCallback(() => {
    setCurrentView("browse");
  }, []);

  const handleBack = useCallback(() => {
    setCurrentView("initial");
  }, []);

  const handleWorkflowSelected = useCallback(
    (workflow: WorkflowFile) => {
      onWorkflowGenerated(workflow);
    },
    [onWorkflowGenerated]
  );

 // Template explorer needs more width for two-column layout
  // Template explorer needs the most width (two-column layout); the
  // dashboard-style initial view needs room for the library strip and the
  // recent-files grid.
  const dialogWidth =
    currentView === "templates"
      ? "max-w-6xl"
      : currentView === "initial"
        ? "max-w-3xl"
        : "max-w-2xl";
  const dialogHeight =
    currentView === "initial" || currentView === "templates" || currentView === "browse"
      ? "max-h-[85vh]"
      : "max-h-[80vh]";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onWheelCapture={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div className={`w-full ${dialogWidth} mx-4 bg-neutral-800 rounded-xl border border-neutral-700 shadow-2xl overflow-clip ${dialogHeight} flex flex-col`} onClick={(e) => e.stopPropagation()}>
        {currentView === "initial" && (
          <QuickstartInitialView
            onNewProject={handleNewProject}
            onSelectTemplates={handleSelectTemplates}
            onSelectVibe={handleSelectVibe}
            onSelectLoad={handleSelectLoad}
            onWorkflowLoaded={(workflow, dirPath) =>
              onWorkflowGenerated(workflow, dirPath)
            }
          />
        )}
        {currentView === "templates" && (
          <TemplateExplorerView
            onBack={handleBack}
            onWorkflowSelected={handleWorkflowSelected}
          />
        )}
        {currentView === "vibe" && (
          <PromptWorkflowView
            onBack={handleBack}
            onWorkflowGenerated={handleWorkflowSelected}
          />
        )}
        {currentView === "browse" && (
          <WorkflowBrowserView
            onBack={handleBack}
            onWorkflowLoaded={(workflow, dirPath) =>
              onWorkflowGenerated(workflow, dirPath)
            }
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
