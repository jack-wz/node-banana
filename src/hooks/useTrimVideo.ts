'use client';

import {
  Input,
  Output,
  VideoSampleSink,
  VideoSampleSource,
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
import { detectKeepRegions, totalRemovedDuration, type KeepRegion } from '@/utils/silenceDetection';

// Re-export encoder support check from useStitchVideos (same encoder)
export { checkEncoderSupport } from './useStitchVideos';

export interface TrimProgress {
  status: 'idle' | 'processing' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  error?: string;
}

/**
 * Standalone async function to trim a video blob to a start/end time range.
 * Preserves embedded audio by trimming it to match the video trim range.
 */
export async function trimVideoAsync(
  videoBlob: Blob,
  startTime: number,
  endTime: number,
  onProgress?: (progress: TrimProgress) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const updateProgress = (
    status: TrimProgress['status'],
    message: string,
    progressValue: number
  ) => {
    onProgress?.({ status, message, progress: progressValue });
  };

  try {
    updateProgress('processing', 'Probing video metadata...', 0);

    // Probe source video
    const { width: probedWidth, height: probedHeight, rotation, bitrate: sourceBitrate } =
      await probeVideoMetadata(videoBlob);

    updateProgress('processing', 'Analyzing source video...', 5);

    const safeWidth = probedWidth > 0 ? probedWidth : FALLBACK_WIDTH;
    const safeHeight = probedHeight > 0 ? probedHeight : FALLBACK_HEIGHT;

    const codecProfile =
      safeWidth * safeHeight > BASELINE_PIXEL_LIMIT ? AVC_LEVEL_5_1 : AVC_LEVEL_4_0;

    const candidateBitrate = Math.max(
      DEFAULT_BITRATE,
      Number.isFinite(sourceBitrate) && sourceBitrate > 0 ? sourceBitrate : 0
    );
    const resolvedBitrate = Math.max(1, Math.floor(candidateBitrate));

    console.log('Trim encoder configuration', {
      width: safeWidth,
      height: safeHeight,
      codecProfile,
      bitrate: resolvedBitrate,
      rotation,
      startTime,
      endTime,
    });

    updateProgress('processing', 'Creating output container...', 8);

    // Open source input
    const blobSource = new BlobSource(videoBlob);
    const input = new Input({
      source: blobSource,
      formats: ALL_FORMATS,
    });

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

      updateProgress('processing', 'Setting up encoder...', 10);

      videoSource = new VideoSampleSource(
        createAvcEncodingConfig(resolvedBitrate, safeWidth, safeHeight, codecProfile)
      );

      const bufferTarget = new BufferTarget();
      output = new Output({
        format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
        target: bufferTarget,
      });

      output.addVideoTrack(videoSource, { rotation, frameRate: MAX_OUTPUT_FPS });

      // Check for audio track and prepare audio encoding
      let pendingAudioBuffer: AudioBuffer | null = null;
      const trimDuration = endTime - startTime;

      try {
        const audioTracks = await input.getAudioTracks();
        if (audioTracks.length > 0) {
          updateProgress('processing', 'Detecting supported audio codec...', 12);

          // Decode audio from the trim range using AudioBufferSink
          const audioTrack = audioTracks[0];
          const sink = new AudioBufferSink(audioTrack);
          const audioBuffers: AudioBuffer[] = [];

          for await (const wrapped of sink.buffers(startTime, endTime)) {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            audioBuffers.push(wrapped.buffer);
          }

          if (audioBuffers.length > 0) {
            // Concatenate decoded audio buffers
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

            // Slice to trim duration if buffer is longer than expected
            const targetSamples = Math.floor(trimDuration * sampleRate);
            const trimmedBuffer =
              targetSamples < concatenated.length
                ? (() => {
                    const sliced = new AudioBuffer({
                      length: Math.max(1, targetSamples),
                      numberOfChannels: numChannels,
                      sampleRate,
                    });
                    for (let ch = 0; ch < numChannels; ch++) {
                      sliced
                        .getChannelData(ch)
                        .set(concatenated.getChannelData(ch).subarray(0, targetSamples));
                    }
                    return sliced;
                  })()
                : concatenated;

            // Find supported audio codec
            const audioCodec = await getFirstEncodableAudioCodec(['aac', 'mp3'], {
              numberOfChannels: numChannels,
              sampleRate,
              bitrate: 128000,
            });

            if (audioCodec) {
              audioSource = new AudioBufferSource({
                codec: audioCodec,
                bitrate: 128000,
              });
              output.addAudioTrack(audioSource);
              pendingAudioBuffer = trimmedBuffer;

              updateProgress('processing', `Audio track ready (${audioCodec})`, 14);
            } else {
              console.warn('No supported audio codec found, output will be video-only');
            }
          }
        }
      } catch (audioErr) {
        // A user Stop must not be swallowed by the graceful audio-degradation path.
        if (audioErr instanceof DOMException && audioErr.name === "AbortError") throw audioErr;
        console.warn('Audio extraction failed, continuing without audio:', audioErr);
      }

      await output.start();
      outputStarted = true;

      // Feed audio early so the muxer can interleave audio packets with video frames.
      // Writing audio after all video causes broken interleaving (Discord won't play audio).
      if (audioSource && pendingAudioBuffer) {
        updateProgress('processing', 'Encoding audio track...', 14);
        await audioSource.add(pendingAudioBuffer);
        await audioSource.close();
        audioSource = null;
      }

      updateProgress('processing', 'Processing video frames...', 15);

      // Create sink for video frames in the trim range
      const sink = new VideoSampleSink(videoTrack);
      const frameInterval = 1 / MAX_OUTPUT_FPS;
      let highestWrittenTimestamp = -frameInterval;
      let segmentMinTimestamp: number | null = null;
      let frameCount = 0;

      for await (const sample of sink.samples(startTime, endTime)) {
        if (signal?.aborted) {
          sample.close();
          throw new DOMException("Aborted", "AbortError");
        }
        const originalTimestamp = sample.timestamp ?? 0;

        // On first sample, record the minimum timestamp to normalize from
        if (segmentMinTimestamp === null) {
          segmentMinTimestamp = originalTimestamp;
        }

        // Normalize timestamp relative to trim start, starting output from 0
        const normalizedTimestamp = originalTimestamp - segmentMinTimestamp;

        // Snap to 60fps grid for consistent framerate
        const snappedTimestamp =
          Math.round(normalizedTimestamp / frameInterval) * frameInterval;

        // Skip duplicate frames
        if (snappedTimestamp < highestWrittenTimestamp) {
          sample.close();
          continue;
        }

        sample.setTimestamp(snappedTimestamp);
        sample.setDuration(frameInterval);
        await videoSource!.add(sample);

        highestWrittenTimestamp = snappedTimestamp;
        sample.close();
        frameCount++;

        // Update progress: 15% to 85% for frame processing
        if (frameCount % 10 === 0) {
          const estimatedFrames = Math.max(1, Math.round(trimDuration * MAX_OUTPUT_FPS));
          const frameProgress = Math.min(1, frameCount / estimatedFrames);
          updateProgress(
            'processing',
            `Processing frames... (${frameCount} frames)`,
            15 + frameProgress * 70
          );
        }
      }

      updateProgress('processing', 'Finalizing output...', 92);

      await videoSource!.close();
      videoSource = null;

      await output!.finalize();
      outputStarted = false;
      output = null;

      const buffer = bufferTarget.buffer;
      if (!buffer) {
        throw new Error('Failed to generate output buffer');
      }

      const outputBlob = new Blob([buffer], { type: 'video/mp4' });

      updateProgress(
        'complete',
        `Trimmed video: ${(outputBlob.size / 1024 / 1024).toFixed(2)}MB`,
        100
      );

      return outputBlob;
    } finally {
      // Cleanup
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
    // Preserve cancellation as an AbortError so the executor treats Stop as
    // idle rather than a failure (normalizing below would strip the type).
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    console.error('Video trim error:', normalizedError);

    onProgress?.({
      status: 'error',
      message: `Error: ${normalizedError.message}`,
      progress: 0,
      error: normalizedError.message,
    });

    throw normalizedError;
  }
}

export interface RemoveSilenceResult {
  blob: Blob;
  removedDuration: number;
}

/**
 * Decode a video's audio track, run silence detection on it, and trim the
 * video+audio down to the detected "keep" regions, stitched back together
 * with no gaps. Falls back to a no-op (single keep region spanning the
 * whole clip) when there's no audio track or nothing silent enough to cut.
 */
export async function trimVideoRemoveSilenceAsync(
  videoBlob: Blob,
  options: { thresholdDb: number; minSilenceDuration: number; paddingDuration: number },
  onProgress?: (progress: TrimProgress) => void,
  signal?: AbortSignal
): Promise<RemoveSilenceResult> {
  const updateProgress = (
    status: TrimProgress['status'],
    message: string,
    progressValue: number
  ) => {
    onProgress?.({ status, message, progress: progressValue });
  };

  try {
    updateProgress('processing', 'Probing video metadata...', 0);

    const { width: probedWidth, height: probedHeight, rotation, bitrate: sourceBitrate } =
      await probeVideoMetadata(videoBlob);

    const safeWidth = probedWidth > 0 ? probedWidth : FALLBACK_WIDTH;
    const safeHeight = probedHeight > 0 ? probedHeight : FALLBACK_HEIGHT;
    const codecProfile =
      safeWidth * safeHeight > BASELINE_PIXEL_LIMIT ? AVC_LEVEL_5_1 : AVC_LEVEL_4_0;
    const candidateBitrate = Math.max(
      DEFAULT_BITRATE,
      Number.isFinite(sourceBitrate) && sourceBitrate > 0 ? sourceBitrate : 0
    );
    const resolvedBitrate = Math.max(1, Math.floor(candidateBitrate));

    updateProgress('processing', 'Analyzing audio for silence...', 5);

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

      // Decode full audio track for silence analysis (if present).
      let keepRegions: KeepRegion[] = [{ startSec: 0, endSec: videoDuration }];
      let fullAudioBuffer: AudioBuffer | null = null;

      const audioTracks = await input.getAudioTracks();
      if (audioTracks.length > 0) {
        const sink = new AudioBufferSink(audioTracks[0]);
        const buffers: AudioBuffer[] = [];
        for await (const wrapped of sink.buffers(0, videoDuration)) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          buffers.push(wrapped.buffer);
        }
        if (buffers.length > 0) {
          const sampleRate = buffers[0].sampleRate;
          const numChannels = buffers[0].numberOfChannels;
          const totalSamples = buffers.reduce((sum, b) => sum + b.length, 0);
          const concatenated = new AudioBuffer({
            length: Math.max(1, totalSamples),
            numberOfChannels: numChannels,
            sampleRate,
          });
          let offset = 0;
          for (const buffer of buffers) {
            for (let ch = 0; ch < numChannels; ch++) {
              concatenated.getChannelData(ch).set(buffer.getChannelData(ch), offset);
            }
            offset += buffer.length;
          }
          fullAudioBuffer = concatenated;
          keepRegions = detectKeepRegions(concatenated, options);
        }
      }

      const removedDuration = totalRemovedDuration(keepRegions, videoDuration);
      const outputDuration = keepRegions.reduce((sum, r) => sum + (r.endSec - r.startSec), 0);

      updateProgress(
        'processing',
        removedDuration > 0
          ? `Removing ${removedDuration.toFixed(1)}s of silence...`
          : 'No silence detected above threshold — copying clip...',
        10
      );

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
      if (fullAudioBuffer) {
        const sampleRate = fullAudioBuffer.sampleRate;
        const numChannels = fullAudioBuffer.numberOfChannels;
        const targetSamples = Math.max(1, Math.round(outputDuration * sampleRate));
        const trimmed = new AudioBuffer({
          length: targetSamples,
          numberOfChannels: numChannels,
          sampleRate,
        });
        let destOffset = 0;
        for (const region of keepRegions) {
          const startSample = Math.round(region.startSec * sampleRate);
          const endSample = Math.min(fullAudioBuffer.length, Math.round(region.endSec * sampleRate));
          const regionLength = Math.max(0, endSample - startSample);
          const copyLength = Math.min(regionLength, targetSamples - destOffset);
          if (copyLength <= 0) continue;
          for (let ch = 0; ch < numChannels; ch++) {
            trimmed
              .getChannelData(ch)
              .set(fullAudioBuffer.getChannelData(ch).subarray(startSample, startSample + copyLength), destOffset);
          }
          destOffset += copyLength;
        }

        const audioCodec = await getFirstEncodableAudioCodec(['aac', 'mp3'], {
          numberOfChannels: numChannels,
          sampleRate,
          bitrate: 128000,
        });
        if (audioCodec) {
          audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: 128000 });
          output.addAudioTrack(audioSource);
          pendingAudioBuffer = trimmed;
        } else {
          console.warn('No supported audio codec found, output will be video-only');
        }
      }

      await output.start();
      outputStarted = true;

      if (audioSource && pendingAudioBuffer) {
        updateProgress('processing', 'Encoding audio track...', 15);
        await audioSource.add(pendingAudioBuffer);
        await audioSource.close();
        audioSource = null;
      }

      updateProgress('processing', 'Processing video frames...', 20);

      const sink = new VideoSampleSink(videoTrack);
      const frameInterval = 1 / MAX_OUTPUT_FPS;
      let highestWrittenTimestamp = -frameInterval;
      let frameCount = 0;
      const estimatedFrames = Math.max(1, Math.round(outputDuration * MAX_OUTPUT_FPS));

      // Write frames from each kept region back-to-back, with each region's
      // timestamps offset by the cumulative output duration written so far —
      // this is what removes the gap where a silent region used to be.
      let regionOutputOffset = 0;
      for (const region of keepRegions) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        let regionMinTimestamp: number | null = null;

        for await (const sample of sink.samples(region.startSec, region.endSec)) {
          if (signal?.aborted) {
            sample.close();
            throw new DOMException('Aborted', 'AbortError');
          }
          const originalTimestamp = sample.timestamp ?? 0;
          if (regionMinTimestamp === null) regionMinTimestamp = originalTimestamp;

          const normalizedTimestamp = originalTimestamp - regionMinTimestamp + regionOutputOffset;
          const snappedTimestamp = Math.round(normalizedTimestamp / frameInterval) * frameInterval;

          if (snappedTimestamp < highestWrittenTimestamp) {
            sample.close();
            continue;
          }

          sample.setTimestamp(snappedTimestamp);
          sample.setDuration(frameInterval);
          await videoSource!.add(sample);

          highestWrittenTimestamp = snappedTimestamp;
          sample.close();
          frameCount++;

          if (frameCount % 10 === 0) {
            const frameProgress = Math.min(1, frameCount / estimatedFrames);
            updateProgress('processing', `Processing frames... (${frameCount} frames)`, 20 + frameProgress * 65);
          }
        }

        regionOutputOffset += region.endSec - region.startSec;
      }

      updateProgress('processing', 'Finalizing output...', 92);

      await videoSource!.close();
      videoSource = null;
      await output!.finalize();
      outputStarted = false;
      output = null;

      const buffer = bufferTarget.buffer;
      if (!buffer) {
        throw new Error('Failed to generate output buffer');
      }

      const outputBlob = new Blob([buffer], { type: 'video/mp4' });

      updateProgress(
        'complete',
        `Removed ${removedDuration.toFixed(1)}s of silence: ${(outputBlob.size / 1024 / 1024).toFixed(2)}MB`,
        100
      );

      return { blob: outputBlob, removedDuration };
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
    console.error('Remove silence error:', normalizedError);

    onProgress?.({
      status: 'error',
      message: `Error: ${normalizedError.message}`,
      progress: 0,
      error: normalizedError.message,
    });

    throw normalizedError;
  }
}
