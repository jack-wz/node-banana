/**
 * IconRail — Weavy-parity 56px left icon rail.
 *
 * Top: logo (opens welcome screen). Middle: tool icons that open the
 * LibraryPanel at a filtered section (search / all / image / video / 3D /
 * audio / text). Bottom: help (keyboard shortcuts) + Discord.
 */

"use client";

import { usePanelStore } from "@/store/panelStore";
import { useWorkflowStore } from "@/store/workflowStore";
import { useT } from "@/i18n";

const railBtn =
  "w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700/60 transition-colors";
const railBtnActive = "bg-neutral-700/70 text-neutral-100";

function RailIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function IconRail() {
  const t = useT();
  const libraryOpen = usePanelStore((state) => state.libraryOpen);
  const libraryFilter = usePanelStore((state) => state.libraryFilter);
  const openLibrary = usePanelStore((state) => state.openLibrary);
  const focusLibrarySearch = usePanelStore((state) => state.focusLibrarySearch);
  const setLibraryOpen = usePanelStore((state) => state.setLibraryOpen);
  const setShowQuickstart = useWorkflowStore((state) => state.setShowQuickstart);
  const setShortcutsDialogOpen = useWorkflowStore((state) => state.setShortcutsDialogOpen);

  const sectionBtn = (filter: string | null) =>
    `${railBtn} ${libraryOpen && libraryFilter === filter ? railBtnActive : ""}`;

  return (
    <nav className="fixed left-0 top-0 bottom-0 z-40 w-14 bg-[#141417] border-r border-neutral-800/70 flex flex-col items-center py-2.5 gap-1">
      {/* Logo — workspace menu */}
      <button
        onClick={() => setShowQuickstart(true)}
        className={`${railBtn} mb-2`}
        title={t("iconRail.welcome")}
      >
        <Image src="/banana_icon.png" alt="Node Banana" width={24} height={24} className="w-6 h-6" />
      </button>

      {/* Search */}
      <button
        onClick={() => focusLibrarySearch()}
        className={`${railBtn} ${libraryOpen ? railBtnActive : ""}`}
        title={t("iconRail.searchLibrary")}
      >
        <RailIcon>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </RailIcon>
      </button>

      {/* All nodes */}
      <button onClick={() => openLibrary(null)} className={sectionBtn(null)} title={t("iconRail.allNodes")}>
        <RailIcon>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </RailIcon>
      </button>

      {/* Image */}
      <button onClick={() => openLibrary("image")} className={sectionBtn("image")} title={t("iconRail.imageNodes")}>
        <RailIcon>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </RailIcon>
      </button>

      {/* Video */}
      <button onClick={() => openLibrary("video")} className={sectionBtn("video")} title={t("iconRail.videoNodes")}>
        <RailIcon>
          <rect x="2" y="5" width="14" height="14" rx="2" />
          <path d="M16 10l6-3v10l-6-3" />
        </RailIcon>
      </button>

      {/* 3D */}
      <button onClick={() => openLibrary("3d")} className={sectionBtn("3d")} title={t("iconRail.3dNodes")}>
        <RailIcon>
          <path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" />
          <path d="M12 22V12" />
          <path d="M12 12L3 7" />
          <path d="M12 12l9-5" />
        </RailIcon>
      </button>

      {/* Audio */}
      <button onClick={() => openLibrary("audio")} className={sectionBtn("audio")} title={t("iconRail.audioNodes")}>
        <RailIcon>
          <path d="M4 10v4" />
          <path d="M8 7v10" />
          <path d="M12 4v16" />
          <path d="M16 7v10" />
          <path d="M20 10v4" />
        </RailIcon>
      </button>

      {/* Text / prompt */}
      <button onClick={() => openLibrary("text")} className={sectionBtn("text")} title={t("iconRail.textNodes")}>
        <RailIcon>
          <path d="M4 7V5h16v2" />
          <path d="M12 5v14" />
          <path d="M9 19h6" />
        </RailIcon>
      </button>

      <div className="flex-1" />

      {/* Close library (when open) */}
      {libraryOpen && (
        <button onClick={() => setLibraryOpen(false)} className={railBtn} title={t("iconRail.closeLibrary")}>
          <RailIcon>
            <path d="M15 18l-6-6 6-6" />
          </RailIcon>
        </button>
      )}

      {/* Help — keyboard shortcuts */}
      <button onClick={() => setShortcutsDialogOpen(true)} className={railBtn} title={t("iconRail.shortcuts")}>
        <RailIcon>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </RailIcon>
      </button>

      {/* Discord */}
      <a
        href="https://discord.com/invite/89Nr6EKkTf"
        target="_blank"
        rel="noopener noreferrer"
        className={railBtn}
        title={t("iconRail.discord")}
      >
        <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 1-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
        </svg>
      </a>
    </nav>
  );
}
import Image from "next/image";
