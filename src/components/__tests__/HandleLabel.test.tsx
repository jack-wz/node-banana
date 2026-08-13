import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HandleLabel } from "@/components/nodes/HandleLabel";
import { HandleTypeIcon, nodeTypeToIconType } from "@/components/nodes/HandleTypeIcon";

describe("HandleLabel", () => {
  it("tints the label text with the port type color (Weavy parity)", () => {
    const { container } = render(
      <HandleLabel label="Image" side="target" color="var(--handle-color-image)" visible={true} />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.color).toBe("var(--handle-color-image)");
    expect(wrapper.textContent).toContain("Image");
  });

  it("infers the icon type from a --handle-color-* CSS variable", () => {
    const { container } = render(
      <HandleLabel label="Image" side="target" color="var(--handle-color-image)" visible={true} />
    );
    // image icon renders a rect + circle + path (photo glyph)
    expect(container.querySelector("svg rect")).not.toBeNull();
  });

  it("uses an explicit type prop over color inference", () => {
    const { container } = render(
      <HandleLabel label="Audio" side="source" color="var(--handle-color-image)" type="audio" visible={true} />
    );
    // audio waveform glyph is all <path>, no rect
    expect(container.querySelector("svg rect")).toBeNull();
    expect(container.querySelector("svg path")).not.toBeNull();
  });

  it("falls back to a plain dot for non-variable colors", () => {
    const { container } = render(
      <HandleLabel label="Out" side="source" color="#6b7280" visible={true} />
    );
    const dot = container.querySelector("svg circle");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("fill")).toBe("#6b7280");
  });

  it("hides with opacity 0 when not visible", () => {
    const { container } = render(
      <HandleLabel label="Image" side="target" color="var(--handle-color-image)" visible={false} />
    );
    expect((container.firstElementChild as HTMLElement).style.opacity).toBe("0");
  });
});

describe("HandleTypeIcon", () => {
  it("uses the palette color for known types", () => {
    const { container } = render(<HandleTypeIcon type="image" />);
    expect(container.querySelector("svg")?.getAttribute("stroke")).toBe("#6EDDB3");
  });

  it("maps node types to icon types", () => {
    expect(nodeTypeToIconType("nanoBanana")).toBe("image");
    expect(nodeTypeToIconType("llmGenerate")).toBe("text");
    expect(nodeTypeToIconType("generateVideo")).toBe("video");
    expect(nodeTypeToIconType("generateAudio")).toBe("audio");
    expect(nodeTypeToIconType("generate3d")).toBe("3d");
    expect(nodeTypeToIconType("easeCurve")).toBe("easeCurve");
    expect(nodeTypeToIconType("unknownThing")).toBe("default");
  });
});
