import { HandleTypeIcon, HandleIconType } from "./HandleTypeIcon";

interface HandleLabelProps {
  label: string;
  side: "target" | "source";
  color: string;
  top?: string;
  visible: boolean;
  opacity?: number;
  /** Explicit port type for the leading icon. Inferred from `color` when omitted. */
  type?: HandleIconType;
}

/** Infer the icon type from a `var(--handle-color-<type>)` color value. */
function inferTypeFromColor(color: string): HandleIconType | undefined {
  const match = color.match(/^var\(--handle-color-([a-zA-Z0-9]+)\)$/);
  if (!match) return undefined;
  const t = match[1];
  return t === "easecurve" ? "easeCurve" : (t as HandleIconType);
}

export function HandleLabel({ label, side, color, top = "calc(50% - 18px)", visible, opacity, type }: HandleLabelProps) {
  const positionStyle = side === "target"
    ? { right: "calc(100% + 8px)" }
    : { left: "calc(100% + 8px)" };

  const iconType = type ?? inferTypeFromColor(color);

  return (
    <div
      className={`absolute flex items-center gap-1 text-[10px] font-medium whitespace-nowrap pointer-events-none${side === "target" ? " flex-row-reverse" : ""}`}
      style={{
        ...positionStyle,
        top,
        zIndex: 10,
        // Weavy tints port labels with the port type color
        color,
        opacity: visible ? (opacity ?? 1) : 0,
        transition: "opacity 150ms ease-in-out",
      }}
    >
      {iconType && iconType !== "default" ? (
        <HandleTypeIcon type={iconType} size={9} />
      ) : (
        <HandleTypeIcon type="default" color={color} size={6} />
      )}
      <span>{label}</span>
    </div>
  );
}
