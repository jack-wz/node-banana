// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelativeTime } from "../relativeTime";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats seconds as just now", () => {
    expect(formatRelativeTime(Date.now() - 30_000)).toMatch(/刚刚|just now/i);
  });

  it("formats minutes", () => {
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toMatch(/5/);
  });

  it("formats hours", () => {
    expect(formatRelativeTime(Date.now() - 3 * 3_600_000)).toMatch(/3/);
  });

  it("formats days", () => {
    expect(formatRelativeTime(Date.now() - 2 * 86_400_000)).toMatch(/2/);
  });

  it("formats months", () => {
    expect(formatRelativeTime(Date.now() - 45 * 86_400_000)).toMatch(/1/);
  });
});

