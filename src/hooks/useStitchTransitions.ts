'use client';

/**
 * Canvas-based per-frame compositing for VideoStitch's transitions and
 * color grading — both implemented as canvas overlay operations rather than
 * a full LUT/filter pipeline (see VideoStitchTransition/VideoStitchColorGrading
 * in src/types/nodes.ts for the supported set).
 *
 * Color grading approximates temperature/tint by drawing a translucent
 * warm/cool (temperature) and magenta/green (tint) overlay on top of the
 * frame using 'overlay'-ish blend semantics via globalCompositeOperation.
 * This is a stylistic approximation, not colorimetrically accurate white
 * balance — acceptable for quick creative grading, not for professional color work.
 */

import type { VideoSample } from 'mediabunny';
import { VideoSample as VideoSampleCtor } from 'mediabunny';
import type { VideoStitchColorGrading, VideoStitchTransition } from '@/types';

/**
 * Draw a video sample into a canvas at the given output dimensions, then
 * apply a color-grading overlay if temperature/tint are non-zero.
 */
function drawGradedFrame(
  ctx: OffscreenCanvasRenderingContext2D,
  sample: VideoSample,
  width: number,
  height: number,
  grading?: VideoStitchColorGrading
): void {
  ctx.clearRect(0, 0, width, height);
  sample.drawWithFit(ctx, { fit: 'contain' });

  if (!grading || (grading.temperature === 0 && grading.tint === 0)) return;

  // Temperature: positive = warm (orange overlay), negative = cool (blue overlay).
  if (grading.temperature !== 0) {
    const alpha = Math.min(0.35, Math.abs(grading.temperature) / 100 * 0.35);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grading.temperature > 0 ? '#FF8C00' : '#3B82F6';
    ctx.fillRect(0, 0, width, height);
  }

  // Tint: positive = magenta overlay, negative = green overlay.
  if (grading.tint !== 0) {
    const alpha = Math.min(0.3, Math.abs(grading.tint) / 100 * 0.3);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grading.tint > 0 ? '#FF00FF' : '#00FF7F';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

/**
 * Render a source sample, with color grading applied, into a new
 * OffscreenCanvas. Used both for immediate per-frame grading and for
 * buffering transition-window frames (whose underlying decoder resource
 * must be released before the blend can run, since blending happens after
 * the whole window has streamed by).
 */
export function renderGradedCanvas(
  sourceSample: VideoSample,
  width: number,
  height: number,
  grading?: VideoStitchColorGrading
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get OffscreenCanvas 2d context');
  drawGradedFrame(ctx, sourceSample, width, height, grading);
  return canvas;
}

/** Wrap an already-rendered canvas as a VideoSample ready for encoding. */
export function canvasToVideoSample(
  canvas: OffscreenCanvas,
  timestamp: number,
  duration: number
): VideoSample {
  return new VideoSampleCtor(canvas, { timestamp, duration });
}

/**
 * Composite one transition frame between two ALREADY-GRADED canvases
 * (grading is applied once when buffering each window's frames via
 * `renderGradedCanvas`, not again here), at the given progress
 * (0 = fully A, 1 = fully B).
 */
export function compositeTransitionCanvases(
  layerA: OffscreenCanvas,
  layerB: OffscreenCanvas,
  progress: number,
  type: VideoStitchTransition['type'],
  width: number,
  height: number
): OffscreenCanvas {
  const p = Math.max(0, Math.min(1, progress));

  const out = new OffscreenCanvas(width, height);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Could not get OffscreenCanvas 2d context');

  switch (type) {
    case 'crossfade': {
      ctx.globalAlpha = 1;
      ctx.drawImage(layerA, 0, 0);
      ctx.globalAlpha = p;
      ctx.drawImage(layerB, 0, 0);
      ctx.globalAlpha = 1;
      break;
    }
    case 'dipToBlack':
    case 'dipToWhite': {
      // First half: A fades to black/white. Second half: black/white fades to B.
      const fillColor = type === 'dipToBlack' ? '#000000' : '#FFFFFF';
      if (p < 0.5) {
        const localP = p / 0.5;
        ctx.drawImage(layerA, 0, 0);
        ctx.globalAlpha = localP;
        ctx.fillStyle = fillColor;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
      } else {
        const localP = (p - 0.5) / 0.5;
        ctx.fillStyle = fillColor;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1 - localP;
        ctx.drawImage(layerB, 0, 0);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'wipe': {
      ctx.drawImage(layerA, 0, 0);
      const wipeX = width * p;
      ctx.drawImage(layerB, wipeX, 0, width - wipeX, height, wipeX, 0, width - wipeX, height);
      break;
    }
    case 'slide': {
      ctx.drawImage(layerA, -width * p, 0);
      ctx.drawImage(layerB, width * (1 - p), 0);
      break;
    }
    case 'zoom': {
      ctx.drawImage(layerA, 0, 0);
      const scale = 0.5 + p * 0.5;
      const scaledW = width * scale;
      const scaledH = height * scale;
      ctx.globalAlpha = p;
      ctx.drawImage(layerB, (width - scaledW) / 2, (height - scaledH) / 2, scaledW, scaledH);
      ctx.globalAlpha = 1;
      break;
    }
    case 'push': {
      ctx.drawImage(layerA, -width * p, 0);
      ctx.drawImage(layerB, width - width * p, 0);
      break;
    }
    default: {
      // 'cut' should never reach here (caller skips transition rendering for cut).
      ctx.drawImage(layerB, 0, 0);
    }
  }

  return out;
}
