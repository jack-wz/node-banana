/**
 * CanvasToolbars — Weavy-parity floating bottom chrome.
 *
 * Left pill:  Library toggle / Sticky note / Pan mode
 * Right pill: Undo / Redo / Zoom% menu (zoom to 100%, fit, ±)
 *
 * The existing centered FloatingActionBar keeps Run + quick-add buttons
 * (FTUX tutorial anchors depend on them).
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflowStore";
import { usePanelStore } from "@/store/panelStore";
import { formatCost } from "@/utils/costCalculator";

const pillClass =
  "flex items-center gap-0.5 bg-[#1b1b1f]/95 backdrop-blur-md rounded-lg shadow-lg border border-neutral-700/60 px-1.5 py-1";
const btnClass =
  "p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

function ZoomMenu() {
  const { zoom } = useViewport();
  const { zoomTo, fitView, zoomIn, zoomOut } = useReactFlow();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        className="px-2 py-1 text-[11px] font-medium text-neutral-300 hover:text-neutral-100 hover:bg-neutral-700 rounded transition-colors tabular-nums min-w-[44px]"
        title="Zoom options"
      >
        {Math.round(zoom * 100)}%
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-36 bg-[#1b1b1f] border border-neutral-700/60 rounded-lg shadow-xl overflow-hidden py-1">
          {[
            { label: "Zoom in", action: () => zoomIn({ duration: 150 }), hint: "+" },
            { label: "Zoom out", action: () => zoomOut({ duration: 150 }), hint: "−" },
            { label: "Zoom to 100%", action: () => zoomTo(1, { duration: 200 }), hint: "⌘0" },
            { label: "Fit view", action: () => fitView({ duration: 200, padding: 0.1 }), hint: "⇧1" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.action();
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-700/40 hover:text-neutral-100 transition-colors"
            >
              <span>{item.label}</span>
              <span className="text-[10px] text-neutral-500">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CanvasLeftToolbar() {
  const toggleLibrary = usePanelStore((state) => state.toggleLibrary);
  const libraryOpen = usePanelStore((state) => state.libraryOpen);
  const addNode = useWorkflowStore((state) => state.addNode);
  const canvasNavigationSettings = useWorkflowStore((state) => state.canvasNavigationSettings);
  const updateCanvasNavigationSettings = useWorkflowStore((state) => state.updateCanvasNavigationSettings);
  const { screenToFlowPosition } = useReactFlow();

  const panActive = canvasNavigationSettings.panMode === "always";

  const handleSelectNavigate = useCallback(() => {
    updateCanvasNavigationSettings({
      ...canvasNavigationSettings,
      panMode: "space",
    });
  }, [canvasNavigationSettings, updateCanvasNavigationSettings]);

  const handleAddSticky = useCallback(() => {
    const pane = document.querySelector(".react-flow");
    const rect = pane?.getBoundingClientRect();
    const center = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    addNode("stickyNote", screenToFlowPosition(center));
  }, [addNode, screenToFlowPosition]);

  const handleTogglePan = useCallback(() => {
    updateCanvasNavigationSettings({
      ...canvasNavigationSettings,
      panMode: panActive ? "space" : "always",
    });
  }, [canvasNavigationSettings, panActive, updateCanvasNavigationSettings]);

  return (
    <div className="fixed bottom-5 left-[68px] z-40">
      <div className={pillClass}>
        <button
          onClick={toggleLibrary}
          className={`${btnClass} ${libraryOpen ? "bg-neutral-700 text-neutral-100" : ""}`}
          title="Toggle library panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </button>
        <div className="w-px h-5 bg-neutral-600 mx-1" />
        <button
          onClick={handleSelectNavigate}
          className={`${btnClass} ${!panActive ? "bg-neutral-700 text-neutral-100" : ""}`}
          title="Navigate tool (V)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 7-6.5 1.5L9 18 5 3z" />
          </svg>
        </button>
        <button
          onClick={handleTogglePan}
          className={`${btnClass} ${panActive ? "bg-neutral-700 text-neutral-100" : ""}`}
          title={panActive ? "Pan tool on (H to toggle, V for navigate)" : "Pan tool (H)"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V6a1.5 1.5 0 013 0v5m0-3a1.5 1.5 0 013 0v1m0 0a1.5 1.5 0 013 0v1m0 0a1.5 1.5 0 013 0v4a6 6 0 01-6 6h-1a6 6 0 01-4.5-2L5 14.5a1.5 1.5 0 012-2l1 1" />
          </svg>
        </button>
        <button onClick={handleAddSticky} className={btnClass} title="Add sticky note">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function CanvasRightToolbar() {
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const canUndo = useWorkflowStore((state) => state.canUndo);
  const canRedo = useWorkflowStore((state) => state.canRedo);
  const lastRunCost = useWorkflowStore((state) => state.lastRunCost);

  return (
    <div className="fixed bottom-5 right-4 z-40">
      <div className={pillClass}>
        {lastRunCost && lastRunCost.cost > 0 && (
          <>
            <div
              className="px-2 py-1 text-[11px] font-medium text-neutral-400 tabular-nums"
              title={`Last run cost · ${new Date(lastRunCost.at).toLocaleTimeString()}`}
            >
              Run {formatCost(lastRunCost.cost)}
            </div>
            <div className="w-px h-5 bg-neutral-600 mx-1" />
          </>
        )}
        <button onClick={undo} disabled={!canUndo} className={btnClass} title="Undo (⌘Z)">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </button>
        <button onClick={redo} disabled={!canRedo} className={btnClass} title="Redo (⌘⇧Z)">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
          </svg>
        </button>
        <div className="w-px h-5 bg-neutral-600 mx-1" />
        <ZoomMenu />
      </div>
    </div>
  );
}
