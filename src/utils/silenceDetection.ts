/**
 * Silence detection over decoded PCM audio.
 *
 * Used by VideoTrim's "removeSilence" mode. Computes short-window RMS
 * level, finds runs below a dB threshold that are long enough to count as
 * "silence", and returns the complementary set of regions to KEEP (with a
 * padding buffer restored on each side), which the caller stitches back
 * together without gaps.
 *
 * Threshold/duration defaults (-40dB, 0.5s minimum silence, 0.1s padding)
 * mirror the values MiniMax Design's `cut_silences` editor operation uses.
 */

export interface SilenceDetectionOptions {
  /** RMS level (dBFS) below which a window counts as silent. Default -40. */
  thresholdDb?: number;
  /** Minimum length of a silent run to remove, in seconds. Default 0.5. */
  minSilenceDuration?: number;
  /** Buffer restored on each side of a removed silent region, in seconds. Default 0.1. */
  paddingDuration?: number;
  /** Analysis window size in seconds. Default 0.02 (20ms). */
  windowDuration?: number;
}

export interface KeepRegion {
  startSec: number;
  endSec: number;
}

const DEFAULT_OPTIONS: Required<SilenceDetectionOptions> = {
  thresholdDb: -40,
  minSilenceDuration: 0.5,
  paddingDuration: 0.1,
  windowDuration: 0.02,
};

/** Convert linear RMS amplitude (0-1) to dBFS. -Infinity for silence (0 amplitude). */
function rmsToDb(rms: number): number {
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

/** Compute RMS amplitude over a single channel's sample range. */
function computeRms(samples: Float32Array, start: number, end: number): number {
  let sumSquares = 0;
  const count = end - start;
  if (count <= 0) return 0;
  for (let i = start; i < end; i++) {
    sumSquares += samples[i] * samples[i];
  }
  return Math.sqrt(sumSquares / count);
}

/**
 * Analyze an AudioBuffer and return the regions to KEEP after removing
 * silence. If the whole buffer is silent, or no silent run is long enough
 * to remove, returns a single region spanning the entire duration
 * (i.e. a no-op).
 */
export function detectKeepRegions(
  buffer: AudioBuffer,
  options?: SilenceDetectionOptions
): KeepRegion[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const duration = buffer.duration;
  if (duration <= 0) return [];

  const sampleRate = buffer.sampleRate;
  const windowSize = Math.max(1, Math.round(opts.windowDuration * sampleRate));
  const channelCount = buffer.numberOfChannels;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < channelCount; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  const totalSamples = buffer.length;
  const windowCount = Math.ceil(totalSamples / windowSize);
  const isSilentWindow: boolean[] = new Array(windowCount);

  for (let w = 0; w < windowCount; w++) {
    const start = w * windowSize;
    const end = Math.min(totalSamples, start + windowSize);
    // Average RMS across all channels for this window.
    let sumRms = 0;
    for (const channelData of channels) {
      sumRms += computeRms(channelData, start, end);
    }
    const avgRms = sumRms / channelCount;
    isSilentWindow[w] = rmsToDb(avgRms) < opts.thresholdDb;
  }

  // Find runs of silent windows long enough to remove.
  const silentRegions: KeepRegion[] = [];
  let runStart: number | null = null;
  for (let w = 0; w < windowCount; w++) {
    if (isSilentWindow[w]) {
      if (runStart === null) runStart = w;
    } else if (runStart !== null) {
      const startSec = (runStart * windowSize) / sampleRate;
      const endSec = (w * windowSize) / sampleRate;
      if (endSec - startSec >= opts.minSilenceDuration) {
        silentRegions.push({ startSec, endSec });
      }
      runStart = null;
    }
  }
  if (runStart !== null) {
    const startSec = (runStart * windowSize) / sampleRate;
    const endSec = duration;
    if (endSec - startSec >= opts.minSilenceDuration) {
      silentRegions.push({ startSec, endSec });
    }
  }

  if (silentRegions.length === 0) {
    return [{ startSec: 0, endSec: duration }];
  }

  // Apply padding: shrink each silent region by paddingDuration on each
  // side (i.e. restore that much to the surrounding "keep" regions), then
  // invert to get the keep regions. Padding only matters at an internal cut
  // point, where there's kept content on both sides to protect — a silent
  // run touching the absolute start/end of the clip is a leading/trailing
  // trim, not a cut, so its outer edge (against the clip boundary) is not
  // padded. Padding it would just preserve a pointless sliver of pure
  // silence at the very start/end instead of trimming it away.
  const paddedSilent = silentRegions
    .map((r) => ({
      startSec:
        r.startSec <= 0
          ? 0
          : Math.min(duration, r.startSec + opts.paddingDuration),
      endSec:
        r.endSec >= duration
          ? duration
          : Math.max(0, r.endSec - opts.paddingDuration),
    }))
    .filter((r) => r.endSec > r.startSec)
    .sort((a, b) => a.startSec - b.startSec);

  const keepRegions: KeepRegion[] = [];
  let cursor = 0;
  for (const region of paddedSilent) {
    if (region.startSec > cursor) {
      keepRegions.push({ startSec: cursor, endSec: region.startSec });
    }
    cursor = Math.max(cursor, region.endSec);
  }
  if (cursor < duration) {
    keepRegions.push({ startSec: cursor, endSec: duration });
  }

  return keepRegions.length > 0 ? keepRegions : [{ startSec: 0, endSec: duration }];
}

/** Total seconds removed by a set of keep regions, given the original duration. */
export function totalRemovedDuration(keepRegions: KeepRegion[], originalDuration: number): number {
  const kept = keepRegions.reduce((sum, r) => sum + (r.endSec - r.startSec), 0);
  return Math.max(0, originalDuration - kept);
}
