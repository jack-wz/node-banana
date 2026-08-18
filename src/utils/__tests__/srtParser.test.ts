import { describe, it, expect } from "vitest";
import { parseSrt, formatSrt, formatSrtTimestamp, findActiveCue } from "../srtParser";

describe("parseSrt", () => {
  it("parses a well-formed multi-cue SRT", () => {
    const srt = `1
00:00:00,000 --> 00:00:02,500
Hello world

2
00:00:02,500 --> 00:00:05,000
Second line`;
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ index: 1, startSec: 0, endSec: 2.5, text: "Hello world" });
    expect(cues[1]).toEqual({ index: 2, startSec: 2.5, endSec: 5, text: "Second line" });
  });

  it("handles multi-line cue text", () => {
    const srt = `1
00:00:00,000 --> 00:00:02,000
Line one
Line two`;
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Line one\nLine two");
  });

  it("accepts '.' as the millisecond separator (non-standard but common)", () => {
    const srt = `1
00:00:00.000 --> 00:00:02.000
Dot separator`;
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].startSec).toBe(0);
    expect(cues[0].endSec).toBe(2);
  });

  it("handles CRLF line endings", () => {
    const srt = "1\r\n00:00:00,000 --> 00:00:02,000\r\nCRLF cue";
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("CRLF cue");
  });

  it("skips malformed blocks without discarding valid ones", () => {
    const srt = `1
not a valid timing line
Bad cue

2
00:00:05,000 --> 00:00:07,000
Good cue`;
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Good cue");
  });

  it("skips cues where end <= start", () => {
    const srt = `1
00:00:05,000 --> 00:00:02,000
Backwards cue`;
    expect(parseSrt(srt)).toHaveLength(0);
  });

  it("renumbers cues sequentially regardless of source index gaps", () => {
    const srt = `7
00:00:00,000 --> 00:00:01,000
First

42
00:00:01,000 --> 00:00:02,000
Second`;
    const cues = parseSrt(srt);
    expect(cues.map((c) => c.index)).toEqual([1, 2]);
  });

  it("returns an empty array for empty or whitespace-only input", () => {
    expect(parseSrt("")).toEqual([]);
    expect(parseSrt("   \n\n  ")).toEqual([]);
  });

  it("tolerates a missing index line", () => {
    const srt = `00:00:00,000 --> 00:00:02,000
No index line`;
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("No index line");
  });
});

describe("formatSrtTimestamp", () => {
  it("formats zero seconds", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
  });

  it("formats sub-second precision", () => {
    expect(formatSrtTimestamp(1.5)).toBe("00:00:01,500");
  });

  it("formats hours/minutes correctly", () => {
    expect(formatSrtTimestamp(3661.25)).toBe("01:01:01,250");
  });

  it("clamps negative durations to zero", () => {
    expect(formatSrtTimestamp(-5)).toBe("00:00:00,000");
  });
});

describe("formatSrt", () => {
  it("round-trips cues through parse -> format -> parse", () => {
    const cues = [
      { index: 1, startSec: 0, endSec: 2, text: "Hi" },
      { index: 2, startSec: 2, endSec: 4, text: "There" },
    ];
    const roundTripped = parseSrt(formatSrt(cues));
    expect(roundTripped).toEqual(cues);
  });

  it("renumbers sequentially on output", () => {
    const cues = [
      { index: 99, startSec: 0, endSec: 1, text: "A" },
      { index: 5, startSec: 1, endSec: 2, text: "B" },
    ];
    const formatted = formatSrt(cues);
    expect(formatted.startsWith("1\n")).toBe(true);
    expect(formatted).toContain("\n2\n");
  });
});

describe("findActiveCue", () => {
  const cues = [
    { index: 1, startSec: 0, endSec: 2, text: "First" },
    { index: 2, startSec: 2, endSec: 4, text: "Second" },
  ];

  it("finds the cue containing a given timestamp", () => {
    expect(findActiveCue(cues, 1)).toEqual(cues[0]);
    expect(findActiveCue(cues, 3)).toEqual(cues[1]);
  });

  it("treats cue end as exclusive", () => {
    expect(findActiveCue(cues, 2)).toEqual(cues[1]);
  });

  it("returns null when no cue matches", () => {
    expect(findActiveCue(cues, 10)).toBeNull();
  });

  it("returns null for an empty cue list", () => {
    expect(findActiveCue([], 0)).toBeNull();
  });
});
