import { describe, it, expect } from "vitest";
import {
  classifyFrameShape,
  marginVFraction,
  wrapSubtitleLine,
  LINE_BUDGET,
  SUBTITLE_STYLE_PRESETS,
} from "../subtitleStyles";

describe("classifyFrameShape", () => {
  it("classifies portrait (9:16)", () => {
    expect(classifyFrameShape(1080, 1920)).toBe("portrait");
  });

  it("classifies landscape (16:9)", () => {
    expect(classifyFrameShape(1920, 1080)).toBe("landscape");
  });

  it("classifies square (1:1)", () => {
    expect(classifyFrameShape(1080, 1080)).toBe("square");
  });

  it("treats near-square ratios as square", () => {
    expect(classifyFrameShape(1000, 1040)).toBe("square");
  });
});

describe("marginVFraction", () => {
  it("uses 12.5% from the top for top position regardless of shape", () => {
    expect(marginVFraction("top", "portrait")).toBe(0.125);
    expect(marginVFraction("top", "landscape")).toBe(0.125);
    expect(marginVFraction("top", "square")).toBe(0.125);
  });

  it("uses shape-specific bottom margins", () => {
    expect(marginVFraction("bottom", "portrait")).toBe(0.25);
    expect(marginVFraction("bottom", "landscape")).toBe(0.08);
    expect(marginVFraction("bottom", "square")).toBe(0.05);
  });

  it("centers regardless of shape", () => {
    expect(marginVFraction("center", "portrait")).toBe(0.5);
  });
});

describe("SUBTITLE_STYLE_PRESETS", () => {
  it("defines all seven named presets", () => {
    expect(Object.keys(SUBTITLE_STYLE_PRESETS).sort()).toEqual(
      ["bold", "casual", "centered", "default", "elegant", "minimal", "modern"].sort()
    );
  });
});

describe("wrapSubtitleLine", () => {
  it("does not wrap text within the line budget", () => {
    const shortText = "Hello";
    expect(wrapSubtitleLine(shortText, "landscape")).toEqual([shortText]);
  });

  it("wraps Latin text at word boundaries on portrait (budget 7 words)", () => {
    const text = "one two three four five six seven eight nine";
    const lines = wrapSubtitleLine(text, "portrait");
    expect(lines.length).toBeGreaterThan(1);
    // Never splits a word across lines.
    for (const line of lines) {
      expect(line.split(" ").every((w) => text.includes(w))).toBe(true);
    }
    expect(lines.join(" ")).toBe(text);
  });

  it("wraps CJK text at character boundaries respecting the per-shape budget", () => {
    const cjkChar = "字";
    const text = cjkChar.repeat(LINE_BUDGET.portrait.cjk + 5);
    const lines = wrapSubtitleLine(text, "portrait");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(0, -1)) {
      expect(line.length).toBeLessThanOrEqual(LINE_BUDGET.portrait.cjk);
    }
  });

  it("respects the wider landscape budget before wrapping", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve thirteen";
    // 13 words fits landscape's 14-word budget — should stay on one line.
    expect(wrapSubtitleLine(text, "landscape")).toEqual([text]);
  });

  it("returns a single line unchanged when it cannot be split further", () => {
    // A single very long "word" (no spaces) can't be word-wrapped.
    const text = "supercalifragilisticexpialidocious";
    expect(wrapSubtitleLine(text, "portrait")).toEqual([text]);
  });
});
