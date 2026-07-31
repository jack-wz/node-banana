/**
 * CanvasContextMenu — right-click menus for the canvas (Weavy parity).
 *
 * - Pane mode: quick-add node list (same category data as NodePickerMenu).
 * - Node mode: Duplicate (⌘D) / Rename / Lock / Delete.
 */

"use client";

import { useEffect, useRef } from "react";
import { NodeType } from "@/types";
import { ALL_NODES_CATEGORIES } from "./FloatingActionBar";
import { HandleTypeIcon, nodeTypeToIconType } from "./nodes/HandleTypeIcon";

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
  onDuplicate,
  onRename,
  onToggleLock,
  onDelete,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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
          <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Add node
          </div>
          {ALL_NODES_CATEGORIES.map((category) => (
            <div key={category.label}>
              <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                {category.label}
              </div>
              {category.nodes.map((node) => (
                <MenuItem
                  key={node.type}
                  label={node.label}
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
            <MenuItem
              label="Duplicate"
              shortcut="⌘D"
              onClick={() => {
                onDuplicate(nodeId);
                onClose();
              }}
            />
            <MenuItem
              label="Rename"
              onClick={() => {
                onRename(nodeId);
                onClose();
              }}
            />
            <MenuItem
              label={nodeLocked ? "Unlock" : "Lock"}
              onClick={() => {
                onToggleLock(nodeId);
                onClose();
              }}
            />
            <div className="my-1 border-t border-neutral-700/60" />
            <MenuItem
              label="Delete"
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
