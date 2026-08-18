/**
 * SRT (SubRip) subtitle parsing and formatting.
 *
 * Shared by the `transcribe` node (produces SRT from ASR) and the
 * `subtitleBurn` node (consumes SRT, whether from a connected transcribe
 * node or hand-pasted by the user).
 */

import type { SubtitleCue } from "@/types";

/**
 * Parse an SRT timestamp ("HH:MM:SS,mmm") into seconds.
 * Returns null if the string doesn't match the expected shape.
 */
function parseSrtTimestamp(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) return null;
  const [, hh, mm, ss, ms] = match;
  const millis = ms.padEnd(3, "0").slice(0, 3);
  return (
    parseInt(hh, 10) * 3600 +
    parseInt(mm, 10) * 60 +
    parseInt(ss, 10) +
    parseInt(millis, 10) / 1000
  );
}

/** Format seconds as an SRT timestamp ("HH:MM:SS,mmm"). */
export function formatSrtTimestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hh = Math.floor(clamped / 3600);
  const mm = Math.floor((clamped % 3600) / 60);
  const ss = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n: number, len: number) => String(n).padStart(len, "0");
  return `${pad(hh, 2)}:${pad(mm, 2)}:${pad(ss, 2)},${pad(ms, 3)}`;
}

/**
 * Parse SRT text into an ordered list of cues.
 *
 * Tolerant of common real-world SRT quirks: '.' instead of ',' as the
 * millisecond separator, CRLF line endings, a missing blank line between
 * the last cue and EOF, and cue index numbers that don't match position
 * (renumbered on output rather than trusted). Malformed blocks are skipped
 * rather than throwing, so one bad cue in a large transcript doesn't
 * discard the rest.
 */
export function parseSrt(srtText: string): SubtitleCue[] {
  if (!srtText || !srtText.trim()) return [];

  const normalized = srtText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];
  let nextIndex = 1;

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    if (lines.length < 2) continue;

    // First line is a cue index if it's a bare integer; otherwise this block
    // has no index line and the first line is the timing line.
    let cursor = 0;
    if (/^\d+$/.test(lines[0].trim())) {
      cursor = 1;
    }

    const timingLine = lines[cursor];
    const timingMatch = timingLine?.match(
      /^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/
    );
    if (!timingMatch) continue;

    const startSec = parseSrtTimestamp(timingMatch[1]);
    const endSec = parseSrtTimestamp(timingMatch[2]);
    if (startSec === null || endSec === null || endSec <= startSec) continue;

    const text = lines
      .slice(cursor + 1)
      .join("\n")
      .trim();
    if (!text) continue;

    cues.push({ index: nextIndex, startSec, endSec, text });
    nextIndex++;
  }

  return cues;
}

/** Serialize cues back into SRT text, renumbering sequentially. */
export function formatSrt(cues: SubtitleCue[]): string {
  return cues
    .map(
      (cue, i) =>
        `${i + 1}\n${formatSrtTimestamp(cue.startSec)} --> ${formatSrtTimestamp(cue.endSec)}\n${cue.text}`
    )
    .join("\n\n");
}

/** Returns the cue (if any) whose [startSec, endSec) range contains `timeSec`. */
export function findActiveCue(cues: SubtitleCue[], timeSec: number): SubtitleCue | null {
  for (const cue of cues) {
    if (timeSec >= cue.startSec && timeSec < cue.endSec) return cue;
  }
  return null;
}
