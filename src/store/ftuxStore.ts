import { create } from "zustand";

export interface TutorialLink {
  text: string;
  url: string;
}

export interface TutorialStep {
  id: string;
  message: string;
  highlightSelector?: string | string[]; // Single selector or array of selectors
  highlightDelay?: number; // Delay in ms before showing highlight
  advanceDelay?: number; // Delay in ms before advancing to next step after action completes (default: 1000)
  requiredAction?:
    | "add-image-node"
    | "add-output-node"
    | "connect-nodes"
    | "run-workflow"
    | "show-connection-menu"
    | "add-nanoBanana-from-menu"
    | "add-prompt-node"
    | "connect-prompt-node";
  position?: "left" | "right" | "center" | "top-center";
  waitForClick?: boolean;
  links?: TutorialLink[];
  completed: boolean;
}

export interface FTUXState {
  tutorialActive: boolean;
  currentTutorialStep: number;
  tutorialSteps: TutorialStep[];
  lockedFeatures: boolean;
  tutorialSampleImage: string | null; // Base64 data URL for tutorial sample image

  // Tutorial progress flags
  connectionMenuShown: boolean;
  nanoBananaAddedFromMenu: boolean;

  // Actions
  startTutorial: () => void;
  skipTutorial: () => void;
  completeCurrentStep: () => void;
  nextTutorialStep: () => void;
  resetTutorial: () => void;
  setConnectionMenuShown: (shown: boolean) => void;
  setNanoBananaAddedFromMenu: (added: boolean) => void;
  loadTutorialSampleImage: () => Promise<void>;
}

const FTUX_COMPLETED_KEY = "node-banana-ftux-completed";

/**
 * Marks FTUX as completed in localStorage.
 */
export function setFTUXCompleted(completed: boolean): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(FTUX_COMPLETED_KEY, JSON.stringify(completed));
  }
}

/**
 * Checks if FTUX has been completed.
 */
export function getFTUXCompleted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(FTUX_COMPLETED_KEY);
    return stored ? JSON.parse(stored) : false;
  } catch {
    return false;
  }
}

/**
 * Tutorial steps for FTUX onboarding.
 */
const initialTutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    message: "tutorial.welcome",
    completed: false,
  },
  {
    id: "add-image",
    message: "tutorial.add-image",
    highlightSelector: '[data-tutorial="image-button"]',
    requiredAction: "add-image-node",
    completed: false,
  },
  {
    id: "explain-node",
    message: "tutorial.explain-node",
    position: "top-center",
    waitForClick: true,
    completed: false,
  },
  {
    id: "explain-node-inputs",
    message: "tutorial.explain-node-inputs",
    highlightSelector: '[data-tutorial="node-input-handle"]',
    highlightDelay: 1000,
    position: "left",
    waitForClick: true,
    completed: false,
  },
  {
    id: "explain-node-outputs",
    message: "tutorial.explain-node-outputs",
    highlightSelector: '[data-tutorial="node-output-handle"]',
    highlightDelay: 1000,
    position: "right",
    waitForClick: true,
    completed: false,
  },
  {
    id: "drag-and-drop",
    message: "tutorial.drag-and-drop",
    highlightSelector: '[data-tutorial="node-output-handle"]',
    position: "right",
    requiredAction: "show-connection-menu",
    advanceDelay: 0,
    completed: false,
  },
  {
    id: "select-generate-image",
    message: "tutorial.select-generate-image",
    highlightSelector: '[data-tutorial="generate-image-option"]',
    position: "top-center",
    requiredAction: "add-nanoBanana-from-menu",
    completed: false,
  },
  {
    id: "add-prompt-node",
    message: "tutorial.add-prompt-node",
    highlightSelector: '[data-tutorial="prompt-button"]',
    position: "top-center",
    requiredAction: "add-prompt-node",
    completed: false,
  },
  {
    id: "connect-prompt-to-generate",
    message: "tutorial.connect-prompt-to-generate",
    highlightSelector: ['[data-tutorial="prompt-output-handle"]', '[data-tutorial="generate-text-input-handle"]'],
    position: "left",
    requiredAction: "connect-prompt-node",
    completed: false,
  },
  {
    id: "populate-content",
    message: "tutorial.populate-content",
    position: "top-center",
    completed: false,
  },
  {
    id: "explain-generate-node",
    message: "tutorial.explain-generate-node",
    highlightSelector: '[data-tutorial="generate-image-node"]',
    position: "top-center",
    waitForClick: true,
    completed: false,
  },
  {
    id: "explain-run-button",
    message: "tutorial.explain-run-button",
    highlightSelector: '[data-tutorial="floating-run-button"]',
    position: "top-center",
    waitForClick: true,
    completed: false,
  },
  {
    id: "explain-run-options",
    message: "tutorial.explain-run-options",
    highlightSelector: '[data-tutorial="floating-run-dropdown"]',
    position: "top-center",
    waitForClick: true,
    completed: false,
  },
  {
    id: "run-workflow",
    message: "tutorial.run-workflow",
    highlightSelector: '[data-tutorial="floating-run-button"]',
    position: "top-center",
    requiredAction: "run-workflow",
    completed: false,
  },
  {
    id: "demonstrate-downstream",
    message: "tutorial.demonstrate-downstream",
    position: "top-center",
    completed: false,
  },
  {
    id: "demonstrate-complete",
    message: "tutorial.demonstrate-complete",
    position: "top-center",
    waitForClick: true,
    completed: false,
  },
  {
    id: "save-project",
    message: "tutorial.save-project",
    highlightSelector: '[data-tutorial="save-button"]',
    position: "top-center",
    waitForClick: true,
    completed: false,
  },
  {
    id: "resources",
    message: "tutorial.resources",
    position: "left",
    waitForClick: true,
    links: [
      { text: "tutorial.discordLink", url: "https://discord.gg/node-banana" },
    ],
    completed: false,
  },
  {
    id: "complete",
    message: "tutorial.complete",
    position: "top-center",
    completed: false,
  },
];

/**
 * FTUX tutorial state management using Zustand.
 * Manages tutorial progression, step completion, and UI locking.
 */
export const useFTUXStore = create<FTUXState>((set, get) => ({
  tutorialActive: false,
  currentTutorialStep: 0,
  tutorialSteps: [],
  lockedFeatures: false,
  tutorialSampleImage: null,
  connectionMenuShown: false,
  nanoBananaAddedFromMenu: false,

  loadTutorialSampleImage: async () => {
    try {
      const response = await fetch("/sample-images/owl.jpg");
      if (!response.ok) {
        console.error("Failed to load tutorial sample image: HTTP", response.status);
        set({ tutorialSampleImage: null });
        return;
      }
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        set({ tutorialSampleImage: base64 });
      };
      reader.onerror = () => {
        console.error("Failed to read tutorial sample image as data URL");
        set({ tutorialSampleImage: null });
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Failed to load tutorial sample image:", error);
      set({ tutorialSampleImage: null });
    }
  },

  startTutorial: () => {
    set({
      tutorialActive: true,
      currentTutorialStep: 0,
      tutorialSteps: initialTutorialSteps.map((step) => ({ ...step, completed: false })),
      lockedFeatures: true,
      connectionMenuShown: false,
      nanoBananaAddedFromMenu: false,
    });

    // Pre-load sample image for tutorial
    get().loadTutorialSampleImage();
  },

  skipTutorial: () => {
    setFTUXCompleted(true);
    set({
      tutorialActive: false,
      lockedFeatures: false,
    });
  },

  completeCurrentStep: () => {
    const { currentTutorialStep, tutorialSteps } = get();
    if (currentTutorialStep >= 0 && currentTutorialStep < tutorialSteps.length) {
      const updatedSteps = [...tutorialSteps];
      const currentStep = updatedSteps[currentTutorialStep];
      updatedSteps[currentTutorialStep] = {
        ...currentStep,
        completed: true,
      };

      // Unlock canvas controls after demonstration nodes are added
      if (currentStep.id === "demonstrate-downstream") {
        set({ tutorialSteps: updatedSteps, lockedFeatures: false });
      } else {
        set({ tutorialSteps: updatedSteps });
      }
    }
  },

  nextTutorialStep: () => {
    const { currentTutorialStep, tutorialSteps } = get();
    const nextStep = currentTutorialStep + 1;

    if (nextStep >= tutorialSteps.length) {
      // Tutorial complete
      setFTUXCompleted(true);
      set({
        tutorialActive: false,
        lockedFeatures: false,
      });
    } else {
      set({ currentTutorialStep: nextStep });
    }
  },

  resetTutorial: () => {
    set({
      tutorialActive: false,
      currentTutorialStep: 0,
      tutorialSteps: [],
      lockedFeatures: false,
    });
  },

  setConnectionMenuShown: (shown: boolean) => set({ connectionMenuShown: shown }),
  setNanoBananaAddedFromMenu: (added: boolean) => set({ nanoBananaAddedFromMenu: added }),
}));
