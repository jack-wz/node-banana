import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickstartInitialView } from "@/components/quickstart/QuickstartInitialView";

describe("QuickstartInitialView", () => {
  const mockOnNewProject = vi.fn();
  const mockOnSelectTemplates = vi.fn();
  const mockOnSelectVibe = vi.fn();
  const mockOnSelectLoad = vi.fn();
  const mockOnWorkflowLoaded = vi.fn();

  function renderView() {
    return render(
      <QuickstartInitialView
        onNewProject={mockOnNewProject}
        onSelectTemplates={mockOnSelectTemplates}
        onSelectVibe={mockOnSelectVibe}
        onSelectLoad={mockOnSelectLoad}
        onWorkflowLoaded={mockOnWorkflowLoaded}
      />
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Header", () => {
    it("renders the Node Banana title and logo", () => {
      renderView();
      expect(screen.getByText("Node Banana")).toBeInTheDocument();
      expect(screen.getAllByAltText("").length).toBeGreaterThan(0);
    });

    it("renders the tagline", () => {
      renderView();
      expect(
        screen.getByText(/node based workflow editor for generative AI pipelines/i)
      ).toBeInTheDocument();
    });

    it("renders the primary New project button and calls onNewProject", () => {
      renderView();
      fireEvent.click(screen.getByText("New project"));
      expect(mockOnNewProject).toHaveBeenCalledTimes(1);
    });

    it("renders the Prompt a workflow action with Beta badge", () => {
      renderView();
      fireEvent.click(screen.getByText("Prompt a workflow"));
      expect(mockOnSelectVibe).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Beta")).toBeInTheDocument();
    });
  });

  describe("Workflow library strip", () => {
    it("renders the library section with a Browse all action", () => {
      renderView();
      expect(screen.getByText("Workflow library")).toBeInTheDocument();
      fireEvent.click(screen.getByText(/Browse all/i));
      expect(mockOnSelectTemplates).toHaveBeenCalledTimes(1);
    });

    it("renders preset template poster cards", () => {
      renderView();
      // PRESET_TEMPLATES has 6 presets; each renders as a button card
      const strip = screen.getByText("Workflow library").closest("section");
      expect(strip).not.toBeNull();
      const cards = strip!.querySelectorAll("button");
      expect(cards.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("Recent workflows", () => {
    it("renders the recent files section", () => {
      renderView();
      expect(screen.getByText("Recent workflows")).toBeInTheDocument();
    });

    it("shows the choose-folder CTA when no workflows directory is configured", () => {
      renderView();
      expect(
        screen.getByText(/Choose a workflows folder/i)
      ).toBeInTheDocument();
    });
  });

  describe("Footer", () => {
    it("renders the Load workflow secondary action", () => {
      renderView();
      fireEvent.click(screen.getByText(/Load workflow/i));
      expect(mockOnSelectLoad).toHaveBeenCalledTimes(1);
    });

    it("renders external links with correct URLs", () => {
      renderView();
      const discord = screen.getByText("Discord").closest("a");
      expect(discord).toHaveAttribute("href", "https://discord.com/invite/89Nr6EKkTf");
      const docs = screen.getByText("Docs").closest("a");
      expect(docs).toHaveAttribute("href", "https://node-banana-docs.vercel.app/");
      const x = screen.getByText("Willie").closest("a");
      expect(x).toHaveAttribute("href", "https://x.com/ReflctWillie");
    });
  });
});

