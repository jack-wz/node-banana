/**
 * i18n store — current locale + translation helper.
 *
 * - Default locale is English (keeps existing behavior/tests intact).
 * - Choice persists to localStorage ("node-banana-locale").
 * - SSR-safe: the store always starts as "en"; call `initLocale()` once
 *   on the client (page.tsx) to hydrate the persisted choice.
 */

import { create } from "zustand";
import { Locale, Dictionary } from "./types";
import { en } from "./en";
import { zh } from "./zh";

const LOCALE_KEY = "node-banana-locale";

const dictionaries: Record<Locale, Dictionary> = { en, zh };

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    return stored === "zh" || stored === "en" ? stored : "en";
  } catch {
    return "en";
  }
}

function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // storage unavailable (private mode / jsdom) — ignore
  }
}

/**
 * Translate a dotted key with optional {param} interpolation.
 * Falls back to English, then to the raw key.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  let value = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  if (params) {
    for (const [name, param] of Object.entries(params)) {
      value = value.split(`{${name}}`).join(String(param));
    }
  }
  return value;
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Hydrate the persisted locale after client mount (SSR-safe). */
  initLocale: () => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: "en",
  setLocale: (locale) => {
    persistLocale(locale);
    set({ locale });
  },
  initLocale: () => {
    const stored = getStoredLocale();
    set((state) => (state.locale === stored ? state : { locale: stored }));
  },
}));

/** Non-hook translation for use outside React components. */
export function t(key: string, params?: Record<string, string | number>): string {
  return translate(useI18nStore.getState().locale, key, params);
}
