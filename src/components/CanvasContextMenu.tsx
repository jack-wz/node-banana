/**
 * CanvasContextMenu — right-click menus for the canvas (Weavy parity).
 *
 * - Pane mode: quick-add node list (same category data as NodePickerMenu).
 * - Node mode: Save as preset / Duplicate (⌘D) / Rename / Lock / Delete.
 */

"use client";

import { useEffect, useRef } from "react";
import { NodeType } from "@/types";
import type { RecentModel } from "@/types";
import { ALL_NODES_CATEGORIES } from "./FloatingActionBar";
import { useT, nodeCategoryKey } from "@/i18n";
import { HandleTypeIcon, nodeTypeToIconType } from "./nodes/HandleTypeIcon";
import { loadRecentModels } from "@/store/utils/localStorage";

export interface CanvasContextMenuState {
  x: number;
  y: number;
  mode: "pane" | "node";
  nodeId?: string;
}

interface CanvasContextMenuProps {
  menu: CanvasContextMenuState;
  nodeLocked?: boolean;
  onAddNode: (type: NodeType, screenX: number, screenY: number) => void;
  onAddModelNode?: (model: RecentModel, screenX: number, screenY: number) => void;
  onSavePreset?: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onRename: (nodeId: string) => void;
  onToggleLock: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

function MenuItem({
  label,
  shortcut,
  danger,
  onClick,
  icon,
}: {
  label: string;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-neutral-300 hover:bg-neutral-700/40 hover:text-neutral-100"
      }`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {shortcut && <span className="text-[10px] text-neutral-500">{shortcut}</span>}
    </button>
  );
}

export function CanvasContextMenu({
  menu,
  nodeLocked,
  onAddNode,
  onAddModelNode,
  onSavePreset,
  onDuplicate,
  onRename,
  onToggleLock,
  onDelete,
  onClose,
}: CanvasContextMenuProps) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);
  const recentModels = menu.mode === "pane" ? loadRecentModels().slice(0, 4) : [];

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const menuWidth = 240;
  const left = Math.min(menu.x, window.innerWidth - menuWidth - 16);
  const top = Math.min(menu.y, window.innerHeight - 360);
  const { nodeId } = menu;

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] rounded-xl border border-neutral-700/60 bg-[#1b1b1f] shadow-2xl overflow-hidden py-1"
      style={{ left, top, width: menuWidth }}
      role="menu"
    >
      {menu.mode === "pane" ? (
        <div className="max-h-[340px] overflow-y-auto">
          {/* Quick Access — recently used models */}
          {recentModels.length > 0 && onAddModelNode && (
            <>
              <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {t("contextMenu.quickAccess")}
              </div>
              {recentModels.map((model) => {
                const capType = model.modelId.includes("video") || model.modelId.includes("seedance") || model.modelId.includes("kling") || model.modelId.includes("veo") || model.modelId.includes("pixverse") || model.modelId.includes("minimax") || model.modelId.includes("happyhorse") || model.modelId.includes("hailuo")
                  ? "video"
                  : model.modelId.includes("3d") || model.modelId.includes("tripo") || model.modelId.includes("meshy")
                  ? "3d"
                  : model.modelId.includes("audio") || model.modelId.includes("elevenlabs") || model.modelId.includes("tts")
                  ? "audio"
                  : "image";
                return (
                  <MenuItem
                    key={`${model.provider}-${model.modelId}`}
                    label={model.displayName}
                    icon={<HandleTypeIcon type={capType} size={12} />}
                    onClick={() => {
                      onAddModelNode(model, menu.x, menu.y);
                      onClose();
                    }}
                  />
                );
              })}
              <div className="my-1 border-t border-neutral-700/60" />
            </>
          )}
          <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            {t("contextMenu.addNode")}
          </div>
          {ALL_NODES_CATEGORIES.map((category) => (
            <div key={category.label}>
              <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                {t(nodeCategoryKey(category.label))}
              </div>
              {category.nodes.map((node) => (
                <MenuItem
                  key={node.type}
                  label={t(`nodeType.${node.type}`)}
                  icon={<HandleTypeIcon type={nodeTypeToIconType(node.type)} size={12} />}
                  onClick={() => {
                    onAddNode(node.type, menu.x, menu.y);
                    onClose();
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        nodeId && (
          <>
            {onSavePreset && (
              <MenuItem
                label={t("contextMenu.savePreset")}
                onClick={() => {
                  onSavePreset(nodeId);
                  onClose();
                }}
              />
            )}
            <MenuItem
              label={t("contextMenu.duplicate")}
              shortcut="⌘D"
              onClick={() => {
                onDuplicate(nodeId);
                onClose();
              }}
            />
            <MenuItem
              label={t("contextMenu.rename")}
              onClick={() => {
                onRename(nodeId);
                onClose();
              }}
            />
            <MenuItem
              label={nodeLocked ? t("contextMenu.unlock") : t("contextMenu.lock")}
              onClick={() => {
                onToggleLock(nodeId);
                onClose();
              }}
            />
            <div className="my-1 border-t border-neutral-700/60" />
            <MenuItem
              label={t("contextMenu.delete")}
              shortcut="⌫"
              danger
              onClick={() => {
                onDelete(nodeId);
                onClose();
              }}
            />
          </>
        )
      )}
    </div>
  );
}
