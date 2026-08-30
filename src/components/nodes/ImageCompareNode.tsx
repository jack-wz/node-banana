"use client";

import { useMemo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { ImageCompareNodeData } from "@/types";
import { useT } from "@/i18n";

type ImageCompareNodeType = Node<ImageCompareNodeData, "imageCompare">;

export function ImageCompareNode({
  id,
  data,
  selected,
}: NodeProps<ImageCompareNodeType>) {
  const t = useT();
  const nodeData = data;
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);

  // Collect images in real-time from connected nodes (same pattern as OutputGalleryNode)
  const displayImages = useMemo(() => {
    const connectedImages: string[] = [];

    // Get edges connected to this node, sorted by creation time for stable ordering
    const sortedEdges = edges
      .filter((edge) => edge.target === id)
      .sort((a, b) => {
        const aTime = (a.data?.createdAt as number) || 0;
        const bTime = (b.data?.createdAt as number) || 0;
        return aTime - bTime;
      });

    sortedEdges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) return;

      let image: string | null = null;

      // Extract image from different node types
      const sourceData = sourceNode.data as Record<string, unknown>;
      if (sourceNode.type === "imageInput") {
        image = typeof sourceData.image === "string" ? sourceData.image : null;
      } else if (
        sourceNode.type === "annotation" ||
        sourceNode.type === "nanoBanana" ||
        sourceNode.type === "removeBackground"
      ) {
        image = typeof sourceData.outputImage === "string" ? sourceData.outputImage : null;
      }

      if (image) {
        connectedImages.push(image);
      }
    });

    return connectedImages;
  }, [edges, nodes, id]);

  const imageA = displayImages[0] || nodeData.imageA || null;
  const imageB = displayImages[1] || nodeData.imageB || null;

  return (
    <BaseNode
      id={id}
      selected={selected}
      className="min-w-[200px]"
    >
      {/* Two labeled image input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        data-handletype="image"
        style={{ top: "35%" }}
      />
      <div
        className="absolute left-[-8px] top-[35%] -translate-y-1/2 -translate-x-full mr-1 text-[9px] text-neutral-400 font-medium"
        style={{ pointerEvents: "none" }}
      >
        A
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="image-1"
        data-handletype="image"
        style={{ top: "65%" }}
      />
      <div
        className="absolute left-[-8px] top-[65%] -translate-y-1/2 -translate-x-full mr-1 text-[9px] text-neutral-400 font-medium"
        style={{ pointerEvents: "none" }}
      >
        B
      </div>

      {/* Comparison view or placeholder */}
      {imageA && imageB ? (
        <div className="flex-1 relative nodrag nopan nowheel">
          <ReactCompareSlider
            itemOne={
              <ReactCompareSliderImage
                src={imageA}
                alt="Image A"
                style={{ objectFit: "contain" }}
              />
            }
            itemTwo={
              <ReactCompareSliderImage
                src={imageB}
                alt="Image B"
                style={{ objectFit: "contain" }}
              />
            }
            portrait={false}
            style={{ width: "100%", height: "100%" }}
          />
          {/* Corner labels */}
          <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-medium px-2 py-1 rounded pointer-events-none">
            A
          </div>
          <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-medium px-2 py-1 rounded pointer-events-none">
            B
          </div>
        </div>
      ) : (
        <div className="w-full flex-1 min-h-[200px] border border-dashed border-neutral-600 rounded flex flex-col items-center justify-center gap-2">
          <span className="text-neutral-500 text-[10px] text-center px-4">
            {!imageA && !imageB
              ? t("node.connect2Images")
              : t("node.connectAnotherImage")}
          </span>
          {imageA && !imageB && (
            <div className="text-[9px] text-neutral-600">{t("node.imageAConnected")}</div>
          )}
          {!imageA && imageB && (
            <div className="text-[9px] text-neutral-600">{t("node.imageBConnected")}</div>
          )}
        </div>
      )}
    </BaseNode>
  );
}
