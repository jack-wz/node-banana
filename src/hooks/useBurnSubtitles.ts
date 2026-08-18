'use client';

/**
 * Burns styled, timed subtitles into a video's frames.
 *
 * Decodes the source video frame-by-frame (same VideoSampleSink/
 * VideoSampleSource pattern as useTrimVideo/useStitchVideos), draws the
 * active subtitle cue's wrapped, styled text onto a canvas copy of each
 * frame that falls within a cue's time range, and re-encodes. Audio is
 * passed through unchanged (subtitles are a video-only overlay).
 */

import {
  Input,
  Output,
  VideoSampleSink,
  VideoSampleSource,
  VideoSample,
  AudioBufferSource,
  AudioBufferSink,
  BlobSource,
  ALL_FORMATS,
  BufferTarget,
  Mp4OutputFormat,
  getFirstEncodableAudioCodec,
} from 'mediabunny';
import { createAvcEncodingConfig, AVC_LEVEL_4_0, AVC_LEVEL_5_1 } from '@/lib/video-encoding';
import {
  DEFAULT_BITRATE,
  MAX_OUTPUT_FPS,
  FALLBACK_WIDTH,
  FALLBACK_HEIGHT,
  BASELINE_PIXEL_LIMIT,
  probeVideoMetadata,
} from '@/lib/video-probing';
import { parseSrt, findActiveCue } from '@/utils/srtParser';
import {
  classifyFrameShape,
  wrapSubtitleLine,
  marginVFraction,
  SUBTITLE_STYLE_PRESETS,
} from '@/utils/subtitleStyles';
import type { SubtitleStylePreset } from '@/types';

// Re-export encoder support check from useStitchVideos (same encoder)
export { checkEncoderSupport } from './useStitchVideos';

export interface BurnSubtitlesProgress {
  status: 'idle' | 'processing' | 'complete' | 'error';
  message: string;
  progress: number;
  error?: string;
}

/** Draw the active cue's wrapped, styled text onto a canvas at its bottom/center/top position. */
function drawSubtitleOverlay(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  position: 'top' | 'center' | 'bottom',
  preset: SubtitleStylePreset
): void {
  const style = SUBTITLE_STYLE_PRESETS[preset];
  const shape = classifyFrameShape(width, height);
  const lines = wrapSubtitleLine(text, shape);
  const fontSize = Math.round(height * style.fontSizeFraction);
  const lineHeight = fontSize * 1.3;
  const marginV = height * marginVFraction(position, shape);

  ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const totalTextHeight = lines.length * lineHeight;
  let startY: number;
  if (position === 'top') {
    startY = marginV + lineHeight / 2;
  } else if (position === 'center') {
    startY = height / 2 - totalTextHeight / 2 + lineHeight / 2;
  } else {
    startY = height - marginV - totalTextHeight + lineHeight / 2;
  }

  if (style.backgroundColor) {
    const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const padX = fontSize * 0.6;
    const padY = fontSize * 0.3;
    ctx.save();
    ctx.globalAlpha = style.backgroundOpacity;
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(
      width / 2 - maxLineWidth / 2 - padX,
      startY - lineHeight / 2 - padY,
      maxLineWidth + padX * 2,
      totalTextHeight + padY * 2
    );
    ctx.restore();
  }

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;

    if (style.accentColor) {
      // Thin accent rule directly above the first line, spanning its width.
      if (i === 0) {
        const lineWidth = ctx.measureText(line).width;
        ctx.save();
        ctx.strokeStyle = style.accentColor;
        ctx.lineWidth = Math.max(2, fontSize * 0.06);
        ctx.beginPath();
        ctx.moveTo(width / 2 - lineWidth / 2, y - lineHeight / 2 - 4);
        ctx.lineTo(width / 2 + lineWidth / 2, y - lineHeight / 2 - 4);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (style.outlineColor && style.outlineWidthFraction > 0) {
      ctx.lineWidth = fontSize * style.outlineWidthFraction;
      ctx.strokeStyle = style.outlineColor;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, width / 2, y);
    }

    ctx.fillStyle = style.textColor;
    ctx.fillText(line, width / 2, y);
  });
}

export async function burnSubtitlesAsync(
  videoBlob: Blob,
  srtText: string,
  stylePreset: SubtitleStylePreset,
  position: 'top' | 'center' | 'bottom',
  onProgress?: (progress: BurnSubtitlesProgress) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const updateProgress = (status: BurnSubtitlesProgress['status'], message: string, progressValue: number) => {
    onProgress?.({ status, message, progress: progressValue });
  };

  try {
    updateProgress('processing', 'Parsing subtitles...', 0);
    const cues = parseSrt(srtText);
    if (cues.length === 0) {
      throw new Error('No valid subtitle cues found in the provided SRT text');
    }

    updateProgress('processing', 'Probing video metadata...', 5);
    const { width: probedWidth, height: probedHeight, rotation, bitrate: sourceBitrate } =
      await probeVideoMetadata(videoBlob);

    const safeWidth = probedWidth > 0 ? probedWidth : FALLBACK_WIDTH;
    const safeHeight = probedHeight > 0 ? probedHeight : FALLBACK_HEIGHT;
    const codecProfile = safeWidth * safeHeight > BASELINE_PIXEL_LIMIT ? AVC_LEVEL_5_1 : AVC_LEVEL_4_0;
    const candidateBitrate = Math.max(
      DEFAULT_BITRATE,
      Number.isFinite(sourceBitrate) && sourceBitrate > 0 ? sourceBitrate : 0
    );
    const resolvedBitrate = Math.max(1, Math.floor(candidateBitrate));

    const blobSource = new BlobSource(videoBlob);
    const input = new Input({ source: blobSource, formats: ALL_FORMATS });

    let videoSource: VideoSampleSource | null = null;
    let audioSource: AudioBufferSource | null = null;
    let output: Output | null = null;
    let outputStarted = false;

    try {
      const videoTracks = await input.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error('No video tracks found in source video.');
      }
      const videoTrack = videoTracks[0];
      const videoDuration = await input.computeDuration();

      videoSource = new VideoSampleSource(
        createAvcEncodingConfig(resolvedBitrate, safeWidth, safeHeight, codecProfile)
      );
      const bufferTarget = new BufferTarget();
      output = new Output({
        format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
        target: bufferTarget,
      });
      output.addVideoTrack(videoSource, { rotation, frameRate: MAX_OUTPUT_FPS });

      let pendingAudioBuffer: AudioBuffer | null = null;
      try {
        const audioTracks = await input.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioTrack = audioTracks[0];
          const sink = new AudioBufferSink(audioTrack);
          const audioBuffers: AudioBuffer[] = [];
          for await (const wrapped of sink.buffers(0, videoDuration)) {
            if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
            audioBuffers.push(wrapped.buffer);
          }
          if (audioBuffers.length > 0) {
            const sampleRate = audioBuffers[0].sampleRate;
            const numChannels = audioBuffers[0].numberOfChannels;
            const totalSamples = audioBuffers.reduce((sum, b) => sum + b.length, 0);
            const concatenated = new AudioBuffer({
              length: Math.max(1, totalSamples),
              numberOfChannels: numChannels,
              sampleRate,
            });
            let offset = 0;
            for (const buffer of audioBuffers) {
              for (let ch = 0; ch < numChannels; ch++) {
                concatenated.getChannelData(ch).set(buffer.getChannelData(ch), offset);
              }
              offset += buffer.length;
            }
            const audioCodec = await getFirstEncodableAudioCodec(['aac', 'mp3'], {
              numberOfChannels: numChannels,
              sampleRate,
              bitrate: 128000,
            });
            if (audioCodec) {
              audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: 128000 });
              output.addAudioTrack(audioSource);
              pendingAudioBuffer = concatenated;
            }
          }
        }
      } catch (audioErr) {
        if (audioErr instanceof DOMException && audioErr.name === 'AbortError') throw audioErr;
        console.warn('Audio extraction failed during subtitle burn, continuing without audio:', audioErr);
      }

      await output.start();
      outputStarted = true;

      if (audioSource && pendingAudioBuffer) {
        updateProgress('processing', 'Encoding audio track...', 10);
        await audioSource.add(pendingAudioBuffer);
        await audioSource.close();
        audioSource = null;
      }

      updateProgress('processing', 'Burning subtitles into frames...', 15);

      const sink = new VideoSampleSink(videoTrack);
      const frameInterval = 1 / MAX_OUTPUT_FPS;
      let highestWrittenTimestamp = -frameInterval;
      let frameCount = 0;
      const estimatedFrames = Math.max(1, Math.round(videoDuration * MAX_OUTPUT_FPS));

      for await (const sample of sink.samples(0, videoDuration)) {
        if (signal?.aborted) {
          sample.close();
          throw new DOMException('Aborted', 'AbortError');
        }
        const timestamp = sample.timestamp ?? 0;
        const activeCue = findActiveCue(cues, timestamp);

        highestWrittenTimestamp += frameInterval;

        if (activeCue) {
          const canvas = new OffscreenCanvas(safeWidth, safeHeight);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get OffscreenCanvas 2d context');
          sample.drawWithFit(ctx, { fit: 'contain' });
          drawSubtitleOverlay(ctx, activeCue.text, safeWidth, safeHeight, position, stylePreset);
          sample.close();
          const gradedSample = new VideoSample(canvas, {
            timestamp: highestWrittenTimestamp,
            duration: frameInterval,
          });
          await videoSource!.add(gradedSample);
          gradedSample.close();
        } else {
          sample.setTimestamp(highestWrittenTimestamp);
          sample.setDuration(frameInterval);
          await videoSource!.add(sample);
          sample.close();
        }

        frameCount++;
        if (frameCount % 10 === 0) {
          const progress = Math.min(1, frameCount / estimatedFrames);
          updateProgress('processing', `Burning subtitles... (${frameCount} frames)`, 15 + progress * 77);
        }
      }

      updateProgress('processing', 'Finalizing output...', 92);
      await videoSource!.close();
      videoSource = null;
      await output!.finalize();
      outputStarted = false;
      output = null;

      const buffer = bufferTarget.buffer;
      if (!buffer) throw new Error('Failed to generate output buffer');
      const outputBlob = new Blob([buffer], { type: 'video/mp4' });

      updateProgress('complete', `Subtitles burned: ${(outputBlob.size / 1024 / 1024).toFixed(2)}MB`, 100);
      return outputBlob;
    } finally {
      if (audioSource) {
        try {
          await audioSource.close();
        } catch (e) {
          console.warn('Failed to close audioSource:', e);
        }
      }
      if (videoSource) {
        try {
          await videoSource.close();
        } catch (e) {
          console.warn('Failed to close videoSource:', e);
        }
      }
      if (output && outputStarted) {
        try {
          await output.cancel();
        } catch (e) {
          console.warn('Failed to cancel output:', e);
        }
      }
      input.dispose();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    console.error('Subtitle burn error:', normalizedError);
    onProgress?.({
      status: 'error',
      message: `Error: ${normalizedError.message}`,
      progress: 0,
      error: normalizedError.message,
    });
    throw normalizedError;
  }
}
