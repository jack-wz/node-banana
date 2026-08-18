/**
 * Subtitle burn-in style presets and per-aspect layout rules.
 *
 * Line-wrap budgets and margin rules mirror the values MiniMax Design's
 * `hub_subtitle_format` tool has already validated in production (see
 * docs research for this feature): portrait/landscape/square classification
 * from output dimensions, CJK vs. Latin word-count budgets per line, and
 * position-based vertical margins. The seven named style presets below are
 * this implementation's own visual definitions (weight/outline/background/
 * accent color combinations) — MiniMax's preset names are reused, but their
 * exact pixel-level styling was not something we could inspect, only their
 * names and behavior contract.
 */

import type { SubtitleStylePreset } from "@/types";

export type FrameShape = "portrait" | "landscape" | "square";

/** Classify a frame shape from its pixel dimensions. */
export function classifyFrameShape(width: number, height: number): FrameShape {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.05) return "square";
  return ratio < 1 ? "portrait" : "landscape";
}

/** Max characters (CJK) / words (Latin) per rendered line, by frame shape. */
export const LINE_BUDGET: Record<FrameShape, { cjk: number; latin: number }> = {
  portrait: { cjk: 10, latin: 7 },
  landscape: { cjk: 16, latin: 14 },
  square: { cjk: 13, latin: 10 },
};

/** Vertical margin as a fraction of frame height, by position. */
export function marginVFraction(position: "top" | "center" | "bottom", shape: FrameShape): number {
  if (position === "top") return 0.125;
  if (position === "center") return 0.5;
  // bottom
  if (shape === "portrait") return 0.25;
  if (shape === "landscape") return 0.08;
  return 0.05; // square
}

export interface SubtitleStyleDefinition {
  fontWeight: "normal" | "bold";
  fontFamily: string;
  /** Font size as a fraction of frame height (scales with resolution rather than a fixed pixel value). */
  fontSizeFraction: number;
  textColor: string;
  outlineColor: string | null;
  outlineWidthFraction: number; // fraction of font size
  backgroundColor: string | null; // null = no background bar
  backgroundOpacity: number;
  accentColor: string | null; // used for a thin top/bottom accent rule under "modern"/"bold"
}

const BASE_FONT_STACK = '"Noto Sans CJK SC", "PingFang SC", "Helvetica Neue", Arial, sans-serif';

export const SUBTITLE_STYLE_PRESETS: Record<SubtitleStylePreset, SubtitleStyleDefinition> = {
  default: {
    fontWeight: "bold",
    fontFamily: BASE_FONT_STACK,
    fontSizeFraction: 0.052,
    textColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidthFraction: 0.08,
    backgroundColor: null,
    backgroundOpacity: 0,
    accentColor: null,
  },
  minimal: {
    fontWeight: "normal",
    fontFamily: BASE_FONT_STACK,
    fontSizeFraction: 0.045,
    textColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidthFraction: 0.05,
    backgroundColor: null,
    backgroundOpacity: 0,
    accentColor: null,
  },
  bold: {
    fontWeight: "bold",
    fontFamily: BASE_FONT_STACK,
    fontSizeFraction: 0.062,
    textColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidthFraction: 0.12,
    backgroundColor: null,
    backgroundOpacity: 0,
    accentColor: "#FFD400",
  },
  centered: {
    fontWeight: "bold",
    fontFamily: BASE_FONT_STACK,
    fontSizeFraction: 0.056,
    textColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidthFraction: 0.08,
    backgroundColor: "#000000",
    backgroundOpacity: 0.35,
    accentColor: null,
  },
  modern: {
    fontWeight: "bold",
    fontFamily: BASE_FONT_STACK,
    fontSizeFraction: 0.05,
    textColor: "#FFFFFF",
    outlineColor: null,
    outlineWidthFraction: 0,
    backgroundColor: "#000000",
    backgroundOpacity: 0.55,
    accentColor: "#5EC8FA",
  },
  elegant: {
    fontWeight: "normal",
    fontFamily: '"Songti SC", "Noto Serif SC", Georgia, serif',
    fontSizeFraction: 0.048,
    textColor: "#F5F0E6",
    outlineColor: "#1A1A1A",
    outlineWidthFraction: 0.04,
    backgroundColor: null,
    backgroundOpacity: 0,
    accentColor: null,
  },
  casual: {
    fontWeight: "normal",
    fontFamily: BASE_FONT_STACK,
    fontSizeFraction: 0.05,
    textColor: "#FFF6D8",
    outlineColor: "#3A2E00",
    outlineWidthFraction: 0.06,
    backgroundColor: null,
    backgroundOpacity: 0,
    accentColor: null,
  },
};

/** Count "line units" for a piece of text: CJK chars count 1 each, Latin words count 1 each. */
function lineUnitCount(text: string): number {
  let units = 0;
  let inLatinWord = false;
  for (const ch of text) {
    const isCjk = /[\u3400-\u9fff\uf900-\ufaff]/.test(ch);
    const isLatinLetter = /[A-Za-z0-9]/.test(ch);
    if (isCjk) {
      units += 1;
      inLatinWord = false;
    } else if (isLatinLetter) {
      if (!inLatinWord) {
        units += 1;
        inLatinWord = true;
      }
    } else {
      inLatinWord = false;
    }
  }
  return units;
}

/**
 * Wrap a cue's text into rendered lines, respecting the per-shape line
 * budget. Wraps at whitespace/punctuation boundaries for Latin text and at
 * any character boundary for CJK text (never mid-word). Overflowing beyond
 * two lines is the caller's responsibility (splitting into another cue);
 * this function only wraps, it does not truncate.
 */
export function wrapSubtitleLine(text: string, shape: FrameShape): string[] {
  const budget = LINE_BUDGET[shape];
  const isMostlyCjk = lineUnitCount(text.replace(/[A-Za-z0-9\s]/g, "")) >= lineUnitCount(text) / 2;
  const maxUnits = isMostlyCjk ? budget.cjk : budget.latin;

  if (lineUnitCount(text) <= maxUnits) return [text];

  const lines: string[] = [];
  let current = "";
  let currentUnits = 0;

  const pushToken = (token: string, tokenUnits: number) => {
    if (currentUnits + tokenUnits > maxUnits && current.length > 0) {
      lines.push(current.trim());
      current = "";
      currentUnits = 0;
    }
    current += token;
    currentUnits += tokenUnits;
  };

  if (isMostlyCjk) {
    for (const ch of text) {
      pushToken(ch, /\s/.test(ch) ? 0 : 1);
    }
  } else {
    const words = text.split(/(\s+)/);
    for (const word of words) {
      if (/^\s+$/.test(word)) {
        current += current.length > 0 ? word : "";
        continue;
      }
      pushToken(word, 1);
    }
  }
  if (current.trim().length > 0) lines.push(current.trim());
  return lines.length > 0 ? lines : [text];
}
