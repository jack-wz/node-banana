/**
 * Single source of truth for handle/port/edge colors.
 *
 * Palette aligned with Weavy (Figma Weave) visual language — soft pastel,
 * high-lightness type colors. Observed from live app.weavy.ai computed styles:
 *   - prompt/text: #F1A0FA (pink)
 *   - image:       #6EDDB3 (mint)
 *   - file/any:    #FEFFF1 (cream)
 * Extended in the same pastel family for node-banana's richer type set.
 *
 * See docs/weavy-research/01-weavy-product-analysis.md §3.2.
 */

export const HANDLE_COLORS = {
  image: "#6EDDB3", // mint — Weavy image port
  text: "#F1A0FA", // pink — Weavy prompt port
  prompt: "#F1A0FA", // alias of text
  video: "#FFB4A2", // soft coral (pastel extension)
  audio: "#C4B5FD", // soft violet (pastel extension)
  "3d": "#9CCBF2", // soft sky (pastel extension)
  file: "#FEFFF1", // cream — Weavy generic file port
  easeCurve: "#FFFFFF", // white
  default: "#9CA3AF", // neutral gray
} as const;

export type HandleColorType = keyof typeof HANDLE_COLORS;

/** Semantic edge colors (non-type states). */
export const EDGE_STATE_COLORS = {
  pause: "#F5A623", // amber
  reference: "#6B7280", // gray
  loop: "#E879F9", // magenta
} as const;

/**
 * Resolve a handle id (e.g. "image-0", "text") to its type color.
 * Strips numeric suffixes used by multi-input nodes.
 */
export function getHandleColor(handleId: string | null | undefined): string {
  if (!handleId) return HANDLE_COLORS.default;
  const normalized = handleId.replace(/-\d+$/, "");
  if (normalized in HANDLE_COLORS) {
    return HANDLE_COLORS[normalized as HandleColorType];
  }
  return HANDLE_COLORS.default;
}
