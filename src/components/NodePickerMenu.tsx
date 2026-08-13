/**
 * NodePickerMenu — Weavy-style node creation menu, opened with the Tab key.
 *
 * Fuzzy-filterable flat list grouped by category. Keyboard: type to filter,
 * ArrowUp/ArrowDown to move, Enter to create at the menu's canvas position,
 * Escape to close. Data is shared with FloatingActionBar via
 * ALL_NODES_CATEGORIES.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodeType } from "@/types";
import { ALL_NODES_CATEGORIES } from "./FloatingActionBar";
import { useT, nodeCategoryKey } from "@/i18n";
import { HandleTypeIcon, nodeTypeToIconType } from "./nodes/HandleTypeIcon";

export interface NodePickerMenuProps {
  /** Screen coordinates where the menu is anchored. */
  x: number;
  y: number;
  onSelect: (type: NodeType) => void;
  onClose: () => void;
}

interface FlatItem {
  type: NodeType;
  label: string;
  category: string;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // subsequence match: "gvi" matches "generate video"
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function NodePickerMenu({ x, y, onSelect, onClose }: NodePickerMenuProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const items: FlatItem[] = [];
    for (const category of ALL_NODES_CATEGORIES) {
      for (const node of category.nodes) {
        const label = t(`nodeType.${node.type}`);
        const categoryLabel = t(nodeCategoryKey(category.label));
        if (
          !query.trim() ||
          fuzzyMatch(query, label) ||
          fuzzyMatch(query, node.label) ||
          fuzzyMatch(query, categoryLabel) ||
          fuzzyMatch(query, category.label)
        ) {
          items.push({ type: node.type, label, category: categoryLabel });
        }
      }
    }
    return items;
  }, [query, t]);

  // Reset selection when the filter changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the active item scrolled into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = filtered[activeIndex];
        if (item) onSelect(item.type);
      }
    },
    [filtered, activeIndex, onSelect, onClose]
  );

  // Close on any pointer down outside the menu
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  // Clamp to viewport
  const menuWidth = 260;
  const menuMaxHeight = 340;
  const left = Math.min(x, window.innerWidth - menuWidth - 16);
  const top = Math.min(y, window.innerHeight - menuMaxHeight - 16);

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] rounded-xl border border-neutral-700/60 bg-[#1b1b1f] shadow-2xl overflow-hidden"
      style={{ left, top, width: menuWidth }}
      role="listbox"
      aria-label={t("nodePicker.ariaLabel")}
    >
      <div className="p-2 border-b border-neutral-700/60">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("nodePicker.placeholder")}
          className="w-full bg-neutral-800/70 text-sm text-neutral-100 placeholder:text-neutral-500 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-neutral-500"
        />
      </div>
      <div ref={listRef} className="max-h-[280px] overflow-y-auto py-1">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-xs text-neutral-500 text-center">{t("nodePicker.noMatches")}</div>
        )}
        {filtered.map((item, index) => {
          const showCategory = index === 0 || filtered[index - 1].category !== item.category;
          return (
            <div key={`${item.category}-${item.type}`}>
              {showCategory && (
                <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {item.category}
                </div>
              )}
              <button
                data-index={index}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelect(item.type)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  index === activeIndex
                    ? "bg-neutral-700/60 text-neutral-100"
                    : "text-neutral-300 hover:bg-neutral-700/40"
                }`}
              >
                <HandleTypeIcon type={nodeTypeToIconType(item.type)} size={12} />
                <span className="truncate">{item.label}</span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-1.5 border-t border-neutral-700/60 flex items-center gap-3 text-[10px] text-neutral-500">
        <span>{t("nodePicker.hintNavigate")}</span>
        <span>{t("nodePicker.hintCreate")}</span>
        <span>{t("nodePicker.hintClose")}</span>
      </div>
    </div>
  );
}
