/**
 * Transcribe Executor
 *
 * Runs ASR (via /api/transcribe, OpenAI Whisper) on a connected video/audio
 * input, producing a plain SRT transcript. If the input is a video, its
 * audio track is extracted client-side first (Whisper needs an audio-only
 * file for reliable results across arbitrary browser-produced containers).
 */

import type { TranscribeNodeData } from "@/types";
import type { NodeExecutionContext } from "./types";

export async function executeTranscribe(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, providerSettings, signal } = ctx;
  const nodeData = node.data as TranscribeNodeData;

  updateNodeData(node.id, { status: "loading", progress: 0, error: null });

  try {
    const inputs = getConnectedInputs(node.id);
    const mediaUrl = inputs.videos[0] ?? inputs.audio[0] ?? null;

    if (!mediaUrl) {
      updateNodeData(node.id, {
        status: "error",
        error: "Connect a video or audio input to transcribe",
        progress: 0,
      });
      throw new Error("Connect a video or audio input to transcribe");
    }

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    updateNodeData(node.id, { progress: 10 });
    const mediaBlob = await fetch(mediaUrl).then((r) => r.blob());
    const isVideo = inputs.videos.length > 0 && inputs.videos[0] === mediaUrl;

    let audioBlob: Blob;
    if (isVideo) {
      updateNodeData(node.id, { progress: 25 });
      const { extractAudioAsync } = await import("@/hooks/useExtractAudio");
      const extracted = await extractAudioAsync(mediaBlob);
      if (!extracted) {
        updateNodeData(node.id, {
          status: "error",
          error: "No audio track found in the connected video",
          progress: 0,
        });
        throw new Error("No audio track found in the connected video");
      }
      audioBlob = extracted;
    } else {
      audioBlob = mediaBlob;
    }

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    updateNodeData(node.id, { progress: 50 });

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.wav");
    formData.append("language", nodeData.language);

    const openaiApiKey = providerSettings.providers.openai?.apiKey;
    const headers: Record<string, string> = {};
    if (openaiApiKey) headers["X-OpenAI-API-Key"] = openaiApiKey;

    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers,
      body: formData,
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorMessage = errorJson.error || `Transcription failed (HTTP ${response.status})`;
      updateNodeData(node.id, { status: "error", error: errorMessage, progress: 0 });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    if (!result.success || typeof result.srt !== "string") {
      const errorMessage = result.error || "Transcription returned no SRT";
      updateNodeData(node.id, { status: "error", error: errorMessage, progress: 0 });
      throw new Error(errorMessage);
    }

    updateNodeData(node.id, {
      outputSrt: result.srt,
      status: "complete",
      progress: 100,
      error: null,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      updateNodeData(node.id, { status: "idle", error: null, progress: 0 });
      throw err;
    }
    const errorMessage = err instanceof Error ? err.message : "Transcription failed";
    updateNodeData(node.id, { status: "error", error: errorMessage, progress: 0 });
    throw err instanceof Error ? err : new Error(errorMessage);
  }
}
