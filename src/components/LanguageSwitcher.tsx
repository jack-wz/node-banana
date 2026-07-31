/**
 * LanguageSwitcher — compact EN/中 toggle for the header pill.
 */

"use client";

import { useI18nStore, LOCALES } from "@/i18n";

export function LanguageSwitcher() {
  const locale = useI18nStore((state) => state.locale);
  const setLocale = useI18nStore((state) => state.setLocale);

  const next = LOCALES.find((l) => l.id !== locale)!;
  const current = LOCALES.find((l) => l.id === locale)!;

  return (
    <button
      onClick={() => setLocale(next.id)}
      className="px-1.5 py-1 text-[11px] font-semibold text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded transition-colors"
      title={`${current.nativeLabel} → ${next.nativeLabel}`}
      aria-label="Switch language / 切换语言"
    >
      {current.label}
    </button>
  );
}
