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
import { ErrorBoundary } from "@/components/ErrorBoundary";
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

  // Prevent React Flow SSR — its internal <Pane> component renders different
  // classNames on server vs client ("draggable" vs "selection"), causing
  // hydration mismatches that React cannot patch up.
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => setClientReady(true), []);

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

  // Client-side only FTUX check. Deferred to an effect (not a lazy
  // useState initializer) for SSR hydration safety: reading localStorage
  // during the pre-hydration client render would mismatch the server's
  // default.
  useEffect(() => {
    if (!getFTUXCompleted()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        {clientReady ? (
          <>
            {/* Full-bleed canvas (Weavy parity): header/panels float above it */}
            <ErrorBoundary
              label="Canvas"
              onError={(error, info) =>
                console.error("Canvas crashed:", error, info)
              }
              fallback={(error, reset) => (
                <div className="h-full w-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="text-sm font-semibold text-red-400">
                    The canvas hit an unexpected error
                  </div>
                  <div className="text-xs text-neutral-400 max-w-md break-words">
                    {error.message || "Unexpected render error"}
                  </div>
                  <div className="text-xs text-neutral-500 max-w-md">
                    Your workflow is still in memory. Try recovering the canvas, or
                    reload the page.
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={reset}
                      className="px-3 py-1.5 text-xs rounded-md border border-red-500 text-red-300 hover:bg-red-500/10"
                    >
                      Try to recover
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-3 py-1.5 text-xs rounded-md border border-neutral-600 text-neutral-300 hover:bg-neutral-700/40"
                    >
                      Reload page
                    </button>
                  </div>
                </div>
              )}
            >
              <WorkflowCanvas />
            </ErrorBoundary>
            <IconRail />
            <Header />
            <LibraryPanel />
            <NodeSettingsPanel />
            <CanvasLeftToolbar />
            <CanvasRightToolbar />
            {(tutorialActive || ftuxCompleted === false) && <FloatingActionBar />}
            <AnnotationModal />
          </>
        ) : (
          <div className="h-full w-full bg-[#0e0e13]" />
        )}
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
