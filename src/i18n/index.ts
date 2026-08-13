/**
 * i18n public API.
 *
 * Usage in components:
 *   const t = useT();
 *   t("common.cancel")                     -> "Cancel" / "取消"
 *   t("tasks.count", { count: 3 })         -> "3 tasks" / "3 个任务"
 *
 * Outside React (stores, utilities): import { t } from "@/i18n";
 */

import { useCallback } from "react";
import { useI18nStore, translate } from "./store";

export { useI18nStore, translate, t, getStoredLocale } from "./store";
export type { Locale, Dictionary } from "./types";
export { LOCALES } from "./types";

/** React hook returning a locale-bound translation function. */
export function useT() {
  const locale = useI18nStore((state) => state.locale);
  return useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale]
  );
}

/** React hook returning a node-type label translator (nodeType.<type>). */
export function useNodeTypeLabel() {
  const t = useT();
  return useCallback((type: string) => t(`nodeType.${type}`), [t]);
}

/** Translate a node-category label ("Input" -> nodeCategory.input). */
export function nodeCategoryKey(label: string): string {
  return `nodeCategory.${label.toLowerCase()}`;
}
