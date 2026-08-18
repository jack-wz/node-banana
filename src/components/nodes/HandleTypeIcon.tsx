/**
 * HandleTypeIcon — small inline-SVG glyphs for port/data types, rendered in
 * the matching pastel handle color (Weavy visual language).
 *
 * Shared by HandleLabel (port labels), FloatingNodeHeader (node header type
 * badge) and the node picker. Falls back to a plain dot for unknown types.
 */

import { HANDLE_COLORS } from "@/utils/handleColors";

export type HandleIconType =
  | "image"
  | "text"
  | "prompt"
  | "video"
  | "audio"
  | "3d"
  | "file"
  | "easeCurve"
  | "default";

interface HandleTypeIconProps {
  type: HandleIconType | string;
  /** Override color; defaults to the palette color for `type`. */
  color?: string;
  size?: number;
  className?: string;
}

export function HandleTypeIcon({ type, color, size = 10, className }: HandleTypeIconProps) {
  const paletteColor =
    color ?? (HANDLE_COLORS[type as keyof typeof HANDLE_COLORS] || HANDLE_COLORS.default);
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: paletteColor,
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };

  switch (type) {
    case "image":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      );
    case "text":
    case "prompt":
      return (
        <svg {...common}>
          <path d="M4 7V5h16v2" />
          <path d="M12 5v14" />
          <path d="M9 19h6" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <rect x="2" y="5" width="14" height="14" rx="2" />
          <path d="M16 10l6-3v10l-6-3" />
        </svg>
      );
    case "audio":
      return (
        <svg {...common}>
          <path d="M4 10v4" />
          <path d="M8 7v10" />
          <path d="M12 4v16" />
          <path d="M16 7v10" />
          <path d="M20 10v4" />
        </svg>
      );
    case "3d":
      return (
        <svg {...common}>
          <path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" />
          <path d="M12 22V12" />
          <path d="M12 12L3 7" />
          <path d="M12 12l9-5" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6" />
        </svg>
      );
    case "easeCurve":
      return (
        <svg {...common}>
          <path d="M3 20c6 0 4-16 9-16s3 16 9 16" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
          <circle cx="12" cy="12" r="6" fill={paletteColor} />
        </svg>
      );
  }
}

/**
 * Map a workflow NodeType to the icon type shown in its header badge.
 */
export function nodeTypeToIconType(nodeType: string): HandleIconType {
  switch (nodeType) {
    case "imageInput":
    case "annotation":
    case "output":
    case "outputGallery":
    case "imageCompare":
    case "splitGrid":
    case "nanoBanana":
    case "removeBackground":
      return "image";
    case "prompt":
    case "promptConstructor":
    case "array":
    case "llmGenerate":
    case "router":
    case "switch":
    case "conditionalSwitch":
      return "text";
    case "videoInput":
    case "generateVideo":
    case "videoStitch":
    case "videoTrim":
    case "videoFrameGrab":
    case "subtitleBurn":
      return "video";
    case "audioInput":
    case "generateAudio":
      return "audio";
    case "generate3d":
    case "glbViewer":
      return "3d";
    case "easeCurve":
      return "easeCurve";
    case "stickyNote":
      return "file";
    case "transcribe":
      return "text";
    default:
      return "default";
  }
}
