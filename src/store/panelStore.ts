/**
 * Panel visibility state for Weavy-parity chrome:
 * left Library panel and bottom-left/right canvas toolbars.
 */

import { create } from "zustand";

interface PanelState {
  libraryOpen: boolean;
  /** Optional icon-type filter for the library list (image/video/3d/audio/text). */
  libraryFilter: string | null;
  /** Incremented to request search-input focus inside the library panel. */
  librarySearchFocusToken: number;
  setLibraryOpen: (open: boolean) => void;
  toggleLibrary: () => void;
  openLibrary: (filter?: string | null) => void;
  setLibraryFilter: (filter: string | null) => void;
  focusLibrarySearch: () => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  libraryOpen: false,
  libraryFilter: null,
  librarySearchFocusToken: 0,
  setLibraryOpen: (open) => set({ libraryOpen: open }),
  toggleLibrary: () => set((state) => ({ libraryOpen: !state.libraryOpen })),
  openLibrary: (filter = null) => set({ libraryOpen: true, libraryFilter: filter }),
  setLibraryFilter: (filter) => set({ libraryFilter: filter }),
  focusLibrarySearch: () =>
    set((state) => ({ libraryOpen: true, librarySearchFocusToken: state.librarySearchFocusToken + 1 })),
}));
