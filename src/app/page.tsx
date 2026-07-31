"use client";

import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Header } from "@/components/Header";
import { WorkflowCanvas } from "@/components/WorkflowCanvas";
import { FloatingActionBar } from "@/components/FloatingActionBar";
import { LibraryPanel } from "@/components/LibraryPanel";
import { NodeSettingsPanel } from "@/components/NodeSettingsPanel";
import { CanvasLeftToolbar, CanvasRightToolbar } from "@/components/CanvasToolbars";
import { IconRail } from "@/components/IconRail";
import { AnnotationModal } from "@/components/AnnotationModal";
import { useWorkflowStore } from "@/store/workflowStore";
import { FTUXModal } from "@/components/onboarding/FTUXModal";
import { getFTUXCompleted, setFTUXCompleted } from "@/store/utils/localStorage";
import { useFTUXStore } from "@/store/ftuxStore";
import { captureSnapshotNow } from "@/utils/versionHistory";
import { useI18nStore } from "@/i18n";

export default function Home() {
  const initializeAutoSave = useWorkflowStore(
    (state) => state.initializeAutoSave
  );
  const cleanupAutoSave = useWorkflowStore((state) => state.cleanupAutoSave);
  const setShowQuickstart = useWorkflowStore((state) => state.setShowQuickstart);
  const [showFTUX, setShowFTUX] = useState(false);
  const tutorialActive = useFTUXStore((state) => state.tutorialActive);
  const [ftuxCompleted, setFtuxCompleted] = useState<boolean | null>(null);

  // Weavy parity: the centered FloatingActionBar is FTUX-only chrome.
  // It renders for first-run users and whenever the tutorial is active
  // (tutorial anchors target its buttons), and stays hidden afterwards.
  useEffect(() => {
    setFtuxCompleted(getFTUXCompleted());
  }, [tutorialActive, showFTUX]);

  useEffect(() => {
    initializeAutoSave();
    return () => cleanupAutoSave();
  }, [initializeAutoSave, cleanupAutoSave]);

  // Hydrate persisted locale (SSR-safe: runs only on client)
  useEffect(() => {
    useI18nStore.getState().initLocale();
  }, []);

  // Version history: debounced auto-snapshot on meaningful manual edits
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useWorkflowStore.subscribe((state, prevState) => {
      if (state.isRunning) return;
      if (state.manualChangeCount === prevState.manualChangeCount) return;
      if (state.nodes.length === 0) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        captureSnapshotNow();
      }, 15000);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useWorkflowStore.getState().hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Client-side only FTUX check (SSR-safe)
  useEffect(() => {
    if (!getFTUXCompleted()) {
      setShowFTUX(true);
    }
  }, []);

  const handleFTUXComplete = () => {
    setShowFTUX(false);
    setFTUXCompleted(true);
  };

  const handleStartTutorial = () => {
    setShowFTUX(false);
    setFTUXCompleted(true);
    setShowQuickstart(false); // Close WelcomeModal if open
    useFTUXStore.getState().startTutorial();
  };

  return (
    <ReactFlowProvider>
      <div className="h-screen relative overflow-hidden">
        {/* Full-bleed canvas (Weavy parity): header/panels float above it */}
        <WorkflowCanvas />
        <IconRail />
        <Header />
        <LibraryPanel />
        <NodeSettingsPanel />
        <CanvasLeftToolbar />
        <CanvasRightToolbar />
        {(tutorialActive || ftuxCompleted === false) && <FloatingActionBar />}
        <AnnotationModal />
        {showFTUX && (
          <FTUXModal
            onComplete={handleFTUXComplete}
            onStartTutorial={handleStartTutorial}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
