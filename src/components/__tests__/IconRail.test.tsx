import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IconRail } from "@/components/IconRail";
import { usePanelStore } from "@/store/panelStore";

vi.mock("@/store/workflowStore", () => ({
  useWorkflowStore: vi.fn((selector) => {
    const state = {
      setShowQuickstart: vi.fn(),
      setShortcutsDialogOpen: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

describe("IconRail", () => {
  beforeEach(() => {
    usePanelStore.setState({ libraryOpen: false, libraryFilter: null, librarySearchFocusToken: 0 });
  });

  it("renders the logo and section icons", () => {
    render(<IconRail />);
    expect(screen.getByAltText("Node Banana")).toBeTruthy();
    expect(screen.getByTitle("Search library")).toBeTruthy();
    expect(screen.getByTitle("All nodes")).toBeTruthy();
    expect(screen.getByTitle("Image nodes")).toBeTruthy();
    expect(screen.getByTitle("Video nodes")).toBeTruthy();
    expect(screen.getByTitle("3D nodes")).toBeTruthy();
    expect(screen.getByTitle("Audio nodes")).toBeTruthy();
    expect(screen.getByTitle("Text nodes")).toBeTruthy();
  });

  it("clicking a section icon opens the library with that filter", () => {
    render(<IconRail />);
    fireEvent.click(screen.getByTitle("Image nodes"));
    expect(usePanelStore.getState().libraryOpen).toBe(true);
    expect(usePanelStore.getState().libraryFilter).toBe("image");
  });

  it("clicking All nodes opens the library without a filter", () => {
    usePanelStore.setState({ libraryFilter: "video" });
    render(<IconRail />);
    fireEvent.click(screen.getByTitle("All nodes"));
    expect(usePanelStore.getState().libraryOpen).toBe(true);
    expect(usePanelStore.getState().libraryFilter).toBeNull();
  });

  it("search icon opens the library and bumps the focus token", () => {
    render(<IconRail />);
    fireEvent.click(screen.getByTitle("Search library"));
    expect(usePanelStore.getState().libraryOpen).toBe(true);
    expect(usePanelStore.getState().librarySearchFocusToken).toBe(1);
  });
});
