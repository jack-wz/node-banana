'use client';

/**
 * Extracts a video's audio track into a standalone playable audio blob,
 * for handing to the /api/transcribe route (Whisper needs an audio-only
 * file; it cannot be pointed at a raw video container reliably across all
 * browser-produced containers).
 *
 * Uses mediabunny's Conversion API (WAV output — universally decodable by
 * server-side ASR, no additional codec negotiation needed).
 */

import { Input, Output, BlobSource, ALL_FORMATS, BufferTarget, WavOutputFormat, Conversion } from 'mediabunny';

/**
 * Extract the audio track from a video blob as a WAV blob. Returns null if
 * the source has no audio track (silent transcription is meaningless, so
 * the caller should surface this as "no speech to transcribe" rather than
 * an error).
 */
export async function extractAudioAsync(videoBlob: Blob): Promise<Blob | null> {
  const blobSource = new BlobSource(videoBlob);
  const input = new Input({ source: blobSource, formats: ALL_FORMATS });

  const audioTrack = await input.getPrimaryAudioTrack();
  if (!audioTrack) return null;

  const bufferTarget = new BufferTarget();
  const output = new Output({
    format: new WavOutputFormat(),
    target: bufferTarget,
  });

  const conversion = await Conversion.init({
    input,
    output,
    video: { discard: true },
  });

  if (!conversion.isValid) {
    throw new Error('Could not set up audio extraction for this file');
  }

  await conversion.execute();

  if (!bufferTarget.buffer) {
    throw new Error('Audio extraction produced no output');
  }

  return new Blob([bufferTarget.buffer], { type: 'audio/wav' });
}
