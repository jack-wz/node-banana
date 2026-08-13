"use client";

import { useState, useCallback, useMemo } from "react";
import {
  BaseEdge,
  EdgeProps,
  getSmoothStepPath,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflowStore";
import { NanoBananaNodeData, WorkflowEdgeData } from "@/types";
import { getSharedGradientId } from "./SharedEdgeGradients";
import { getHandleColor, EDGE_STATE_COLORS } from "@/utils/handleColors";

interface EdgeData extends WorkflowEdgeData {
  offsetX?: number;
  offsetY?: number;
}

export function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
  sourceHandleId,
  targetHandleId,
  source,
  target,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const edgeStyle = useWorkflowStore((state) => state.edgeStyle);
  const [isDragging, setIsDragging] = useState(false);

  // Narrow selector: returns boolean, only re-renders when selection relevance changes
  const isConnectedToSelection = useWorkflowStore((state) =>
    state.nodes.some((n) => n.selected && (n.id === source || n.id === target))
  );

  const edgeData = data as EdgeData | undefined;
  const offsetX = edgeData?.offsetX ?? 0;
  const offsetY = edgeData?.offsetY ?? 0;
  const hasPause = edgeData?.hasPause ?? false;

  // Narrow selector: only re-renders when target loading status changes
  const isTargetLoading = useWorkflowStore((state) => {
    const targetNode = state.nodes.find((n) => n.id === target);
    if (targetNode?.type !== "nanoBanana") return false;
    return (targetNode.data as NanoBananaNodeData).status === "loading";
  });

  // Determine edge color based on handle type (magenta for loop edges, amber if paused)
  const edgeColor = useMemo(() => {
    if (edgeData?.isLoop) return EDGE_STATE_COLORS.loop;
    if (hasPause) return EDGE_STATE_COLORS.pause;
    return getHandleColor(sourceHandleId || targetHandleId);
  }, [edgeData?.isLoop, hasPause, sourceHandleId, targetHandleId]);

  // Weavy signature: edge gradient runs from the SOURCE handle type color
  // to the TARGET handle type color (per-edge, userSpaceOnUse).
  const sourceColor = useMemo(() => getHandleColor(sourceHandleId), [sourceHandleId]);
  const targetColor = useMemo(() => getHandleColor(targetHandleId), [targetHandleId]);
  const pairGradientId = `nb-edge-grad-${id}`;

  // Reference shared gradient by color key + selection state
  const gradientId = useMemo(() => {
    if (edgeData?.isLoop) {
      const selectionKey = isConnectedToSelection ? "active" : "dimmed";
      return getSharedGradientId("loop", selectionKey);
    }
    if (hasPause) {
      const selectionKey = isConnectedToSelection ? "active" : "dimmed";
      return getSharedGradientId("pause", selectionKey);
    }
    // Normal edges use the per-edge source→target pair gradient
    return pairGradientId;
  }, [edgeData?.isLoop, hasPause, pairGradientId, isConnectedToSelection]);

  // Dim non-special edges slightly when they are not connected to the current selection
  const edgeOpacity = edgeData?.isLoop || hasPause ? 1 : isConnectedToSelection ? 1 : 0.55;

  // Calculate the path based on edge style
  const [edgePath, labelX, labelY] = useMemo(() => {
    // Loop edges: smooth arc that exits/enters along handle directions, bowed below nodes
    if (edgeData?.isLoop) {
      const dist = Math.sqrt((targetX - sourceX) ** 2 + (targetY - sourceY) ** 2);
      const extent = Math.max(100, dist * 0.4);
      const drop = Math.max(120, dist * 0.4);

      // Direction vectors matching handle positions
      const dir: Record<string, [number, number]> = {
        top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0],
      };
      const [sdx, sdy] = dir[sourcePosition] ?? [1, 0];
      const [tdx, tdy] = dir[targetPosition] ?? [-1, 0];

      // Follow handle direction + push arc below the nodes
      const cp1x = sourceX + sdx * extent;
      const cp1y = sourceY + sdy * extent + drop;
      const cp2x = targetX + tdx * extent;
      const cp2y = targetY + tdy * extent + drop;

      const path = `M${sourceX},${sourceY} C${cp1x},${cp1y} ${cp2x},${cp2y} ${targetX},${targetY}`;
      // Label at bezier midpoint (t=0.5)
      const lx = 0.125 * sourceX + 0.375 * cp1x + 0.375 * cp2x + 0.125 * targetX;
      const ly = 0.125 * sourceY + 0.375 * cp1y + 0.375 * cp2y + 0.125 * targetY;
      return [path, lx, ly] as [string, number, number];
    }

    if (edgeStyle === "curved") {
      return getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        curvature: 0.25,
      });
    } else {
      return getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8,
        offset: offsetX,
      });
    }
  }, [edgeStyle, edgeData?.isLoop, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, offsetX]);

  // Calculate handle positions on the path segments (only for angular mode)
  const handlePositions = useMemo(() => {
    if (edgeStyle === "curved") return [];

    const handles: { x: number; y: number; direction: "horizontal" | "vertical" }[] = [];

    const midX = (sourceX + targetX) / 2 + offsetX;
    const midY = (sourceY + targetY) / 2 + offsetY;

    // Middle segment handle
    if (Math.abs(targetX - sourceX) > 50) {
      handles.push({
        x: midX,
        y: midY,
        direction: "horizontal",
      });
    }

    return handles;
  }, [edgeStyle, sourceX, sourceY, targetX, targetY, offsetX, offsetY]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: "horizontal" | "vertical") => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startOffsetX = offsetX;
      const startOffsetY = offsetY;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        setEdges((edges) =>
          edges.map((edge) => {
            if (edge.id === id) {
              return {
                ...edge,
                data: {
                  ...edge.data,
                  offsetX: direction === "horizontal" ? startOffsetX + deltaX : startOffsetX,
                  offsetY: direction === "vertical" ? startOffsetY + deltaY : startOffsetY,
                },
              };
            }
            return edge;
          })
        );
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [id, offsetX, offsetY, setEdges]
  );

  return (
    <>
      {/* Per-edge source→target type-color gradient (Weavy signature) */}
      {!edgeData?.isLoop && !hasPause && (
        <defs>
          <linearGradient
            id={pairGradientId}
            gradientUnits="userSpaceOnUse"
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
          >
            <stop offset="0%" stopColor={sourceColor} />
            <stop offset="100%" stopColor={targetColor} />
          </linearGradient>
        </defs>
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: `url(#${gradientId})`,
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          opacity: edgeOpacity,
        }}
      />

      {/* Animated pulse overlay when target is loading */}
      {isTargetLoading && (
        <>
          {/* Outer glow — replaces blur(6px) filter for better perf on Windows */}
          <path
            d={edgePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={20}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.06}
          />
          {/* Inner glow */}
          <path
            d={edgePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.12}
          />
          {/* Animated flowing pulse using stroke-dasharray */}
          <path
            d={edgePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="20 30"
            style={{
              animation: "flowPulse 1s linear infinite",
            }}
          />
        </>
      )}

      {/* Invisible wider path for easier selection (Weavy uses 40px) */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={40}
        stroke="transparent"
        className="react-flow__edge-interaction"
      />

      {/* Pause indicator near target connection point */}
      {hasPause && (
        <g transform={`translate(${targetX - 24}, ${targetY})`}>
          {/* Background circle */}
          <circle
            r={10}
            fill="#27272a"
            stroke={edgeColor}
            strokeWidth={2}
          />
          {/* Pause bars */}
          <rect x={-4} y={-5} width={2.5} height={10} fill={edgeColor} rx={1} />
          <rect x={1.5} y={-5} width={2.5} height={10} fill={edgeColor} rx={1} />
        </g>
      )}

      {/* Loop indicator at edge midpoint */}
      {edgeData?.isLoop && (
        <foreignObject
          x={labelX - 28}
          y={labelY - 12}
          width={56}
          height={24}
          className="pointer-events-none"
        >
          <div className="flex items-center justify-center gap-1 px-2 py-0.5 bg-neutral-800/90 border border-fuchsia-500/60 rounded-full text-[10px] font-medium">
            <span className="text-fuchsia-300">↻</span>
            <span className="text-fuchsia-100">{edgeData.loopCount || 3}×</span>
          </div>
        </foreignObject>
      )}

      {/* Draggable handles on segments */}
      {(selected || isDragging) &&
        handlePositions.map((handle, index) => (
          <g key={index}>
            <circle
              cx={handle.x}
              cy={handle.y}
              r={6}
              fill="white"
              stroke={edgeColor}
              strokeWidth={2}
              style={{
                cursor: handle.direction === "horizontal" ? "ew-resize" : "ns-resize",
              }}
              onMouseDown={(e) => handleMouseDown(e, handle.direction)}
            />
          </g>
        ))}
    </>
  );
}
