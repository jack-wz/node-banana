import { describe, it, expect, beforeAll } from "vitest";
import { detectKeepRegions, totalRemovedDuration } from "../silenceDetection";

// jsdom doesn't implement AudioBuffer — polyfill a minimal version, same
// pattern used by src/hooks/__tests__/useStitchVideos.test.ts.
class MockAudioBuffer {
  readonly sampleRate: number;
  readonly length: number;
  readonly duration: number;
  readonly numberOfChannels: number;
  private channels: Float32Array[];

  constructor(options: { length: number; numberOfChannels: number; sampleRate: number }) {
    this.length = options.length;
    this.numberOfChannels = options.numberOfChannels;
    this.sampleRate = options.sampleRate;
    this.duration = options.length / options.sampleRate;
    this.channels = Array.from({ length: options.numberOfChannels }, () => new Float32Array(options.length));
  }
  getChannelData(channel: number): Float32Array {
    return this.channels[channel];
  }
}

beforeAll(() => {
  if (typeof globalThis.AudioBuffer === "undefined") {
    (globalThis as unknown as { AudioBuffer: typeof MockAudioBuffer }).AudioBuffer = MockAudioBuffer;
  }
});

/**
 * Build a mono AudioBuffer at the given sample rate where each entry in
 * `segments` is [durationSec, amplitude]. amplitude 0 = true silence,
 * a small positive value simulates quiet-but-not-silent audio (below
 * threshold), and 1 simulates full-volume audio (well above threshold).
 */
function buildBuffer(segments: Array<[number, number]>, sampleRate = 1000): AudioBuffer {
  const totalSamples = segments.reduce((sum, [dur]) => sum + Math.round(dur * sampleRate), 0);
  const buffer = new AudioBuffer({ length: totalSamples, numberOfChannels: 1, sampleRate });
  const data = buffer.getChannelData(0);
  let offset = 0;
  for (const [dur, amplitude] of segments) {
    const samples = Math.round(dur * sampleRate);
    for (let i = 0; i < samples; i++) {
      data[offset + i] = amplitude;
    }
    offset += samples;
  }
  return buffer;
}

describe("detectKeepRegions", () => {
  it("returns the full duration as a single keep region when nothing is silent", () => {
    const buffer = buildBuffer([[2, 1]]);
    const regions = detectKeepRegions(buffer);
    expect(regions).toEqual([{ startSec: 0, endSec: 2 }]);
  });

  it("returns the full duration when a silent run is shorter than minSilenceDuration", () => {
    const buffer = buildBuffer([[1, 1], [0.2, 0], [1, 1]]);
    const regions = detectKeepRegions(buffer, { minSilenceDuration: 0.5 });
    expect(regions).toEqual([{ startSec: 0, endSec: 2.2 }]);
  });

  it("removes a silent run in the middle, keeping padding on each side", () => {
    // 1s loud, 1s silent, 1s loud — with default padding 0.1s, the silent
    // region shrinks to [1.1, 1.9), so keep regions are [0,1.1) and [1.9,3).
    const buffer = buildBuffer([[1, 1], [1, 0], [1, 1]]);
    const regions = detectKeepRegions(buffer, {
      thresholdDb: -40,
      minSilenceDuration: 0.5,
      paddingDuration: 0.1,
    });
    expect(regions).toHaveLength(2);
    expect(regions[0].startSec).toBe(0);
    expect(regions[0].endSec).toBeCloseTo(1.1, 1);
    expect(regions[1].startSec).toBeCloseTo(1.9, 1);
    expect(regions[1].endSec).toBe(3);
  });

  it("removes a silent run at the very start", () => {
    const buffer = buildBuffer([[1, 0], [1, 1]]);
    const regions = detectKeepRegions(buffer, { minSilenceDuration: 0.5, paddingDuration: 0.1 });
    expect(regions).toHaveLength(1);
    expect(regions[0].startSec).toBeCloseTo(0.9, 1);
    expect(regions[0].endSec).toBe(2);
  });

  it("removes a silent run at the very end", () => {
    const buffer = buildBuffer([[1, 1], [1, 0]]);
    const regions = detectKeepRegions(buffer, { minSilenceDuration: 0.5, paddingDuration: 0.1 });
    expect(regions).toHaveLength(1);
    expect(regions[0].startSec).toBe(0);
    expect(regions[0].endSec).toBeCloseTo(1.1, 1);
  });

  it("removes multiple non-adjacent silent runs", () => {
    const buffer = buildBuffer([[1, 1], [1, 0], [1, 1], [1, 0], [1, 1]]);
    const regions = detectKeepRegions(buffer, { minSilenceDuration: 0.5, paddingDuration: 0.1 });
    expect(regions).toHaveLength(3);
  });

  it("treats a quiet-but-above-threshold signal as non-silent", () => {
    // amplitude 0.1 -> ~-20dB, above a -40dB threshold, so this should NOT be removed.
    const buffer = buildBuffer([[1, 1], [1, 0.1], [1, 1]]);
    const regions = detectKeepRegions(buffer, { thresholdDb: -40, minSilenceDuration: 0.5 });
    expect(regions).toEqual([{ startSec: 0, endSec: 3 }]);
  });

  it("returns an empty array for a zero-duration buffer", () => {
    const buffer = buildBuffer([[0, 0]]);
    expect(detectKeepRegions(buffer)).toEqual([]);
  });
});

describe("totalRemovedDuration", () => {
  it("computes the difference between original and kept duration", () => {
    const regions = [{ startSec: 0, endSec: 1 }, { startSec: 2, endSec: 3 }];
    expect(totalRemovedDuration(regions, 3)).toBe(1);
  });

  it("returns 0 when nothing was removed", () => {
    const regions = [{ startSec: 0, endSec: 5 }];
    expect(totalRemovedDuration(regions, 5)).toBe(0);
  });

  it("clamps to 0 rather than going negative", () => {
    const regions = [{ startSec: 0, endSec: 10 }];
    expect(totalRemovedDuration(regions, 5)).toBe(0);
  });
});
