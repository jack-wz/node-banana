/**
 * i18n types — bilingual (English / 中文) UI support.
 */

export type Locale = "en" | "zh";

/** Flat dotted-key dictionary: "header.untitled" -> "Untitled". */
export type Dictionary = Record<string, string>;

export const LOCALES: { id: Locale; label: string; nativeLabel: string }[] = [
  { id: "en", label: "EN", nativeLabel: "English" },
  { id: "zh", label: "中", nativeLabel: "中文" },
];
