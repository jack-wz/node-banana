import { describe, it, expect, beforeEach } from "vitest";
import { translate, useI18nStore, t } from "../store";
import { en } from "../en";
import { zh } from "../zh";

describe("i18n translate", () => {
  it("returns the English string for locale en", () => {
    expect(translate("en", "common.cancel")).toBe("Cancel");
  });

  it("returns the Chinese string for locale zh", () => {
    expect(translate("zh", "common.cancel")).toBe("取消");
  });

  it("falls back to English when the zh key is missing", () => {
    // temporarily remove a key to prove the fallback path
    const original = zh["common.save"];
    delete zh["common.save"];
    expect(translate("zh", "common.save")).toBe("Save");
    zh["common.save"] = original;
  });

  it("falls back to the raw key when unknown", () => {
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
  });

  it("interpolates {params}", () => {
    expect(translate("en", "header.savedAt", { time: "3:04 PM" })).toBe(
      "Saved 3:04 PM"
    );
    expect(translate("zh", "header.savedAt", { time: "下午3:04" })).toBe(
      "已保存 下午3:04"
    );
  });

  it("interpolates the same param multiple times", () => {
    expect(translate("en", "fab.runSelectedCount", { count: 3 })).toContain("3");
  });
});

describe("i18n store", () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: "en" });
  });

  it("defaults to English", () => {
    expect(useI18nStore.getState().locale).toBe("en");
  });

  it("switches locale via setLocale", () => {
    useI18nStore.getState().setLocale("zh");
    expect(useI18nStore.getState().locale).toBe("zh");
    expect(t("common.cancel")).toBe("取消");
  });

  it("initLocale keeps English when storage is unavailable", () => {
    useI18nStore.getState().initLocale();
    expect(useI18nStore.getState().locale).toBe("en");
  });
});

describe("dictionary coverage", () => {
  it("every zh key exists in the en dictionary (fallback integrity)", () => {
    const missing = Object.keys(zh).filter((key) => !(key in en));
    expect(missing).toEqual([]);
  });

  it("has no empty translations", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim().length, `en:${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(zh)) {
      expect(value.trim().length, `zh:${key}`).toBeGreaterThan(0);
    }
  });
});
