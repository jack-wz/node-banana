/**
 * SubtitleBurn Executor
 *
 * Burns styled, timed subtitles (from a connected transcribe node, or a
 * hand-pasted/edited SRT string) into a connected video's frames.
 */

import type { SubtitleBurnNodeData } from "@/types";
import { revokeBlobUrl } from "@/store/utils/executionUtils";
import type { NodeExecutionContext } from "./types";

export async function executeSubtitleBurn(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, getNodes, signal } = ctx;
  const nodeData = node.data as SubtitleBurnNodeData;

  if (nodeData.encoderSupported === false) {
    updateNodeData(node.id, {
      status: "error",
      error: "Browser does not support video encoding",
      progress: 0,
    });
    throw new Error("Browser does not support video encoding");
  }

  updateNodeData(node.id, { status: "loading", progress: 0, error: null });

  try {
    const inputs = getConnectedInputs(node.id);

    if (inputs.videos.length === 0) {
      updateNodeData(node.id, {
        status: "error",
        error: "Connect a video input to burn subtitles",
        progress: 0,
      });
      throw new Error("Connect a video input to burn subtitles");
    }

    const freshNodeData = getNodes().find((n) => n.id === node.id)?.data as
      | SubtitleBurnNodeData
      | undefined;
    const srtText = freshNodeData?.srtText ?? nodeData.srtText;

    if (!srtText || !srtText.trim()) {
      updateNodeData(node.id, {
        status: "error",
        error: "No SRT text to burn — connect a transcribe node or paste SRT text",
        progress: 0,
      });
      throw new Error("No SRT text to burn — connect a transcribe node or paste SRT text");
    }

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const videoUrl = inputs.videos[0];
    const videoBlob = await fetch(videoUrl).then((r) => r.blob());

    const { burnSubtitlesAsync } = await import("@/hooks/useBurnSubtitles");
    const outputBlob = await burnSubtitlesAsync(
      videoBlob,
      srtText,
      nodeData.stylePreset,
      nodeData.position,
      (progress) => {
        if (signal?.aborted) return;
        updateNodeData(node.id, { progress: progress.progress });
      },
      signal
    );

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const oldData = getNodes().find((n) => n.id === node.id)?.data as
      | Record<string, unknown>
      | undefined;
    revokeBlobUrl(oldData?.outputVideo as string | undefined);

    let outputVideo: string;
    if (outputBlob.size > 20 * 1024 * 1024) {
      outputVideo = URL.createObjectURL(outputBlob);
    } else {
      const reader = new FileReader();
      outputVideo = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("FileReader error while reading subtitled video"));
        reader.onabort = () => reject(new Error("FileReader aborted while reading subtitled video"));
        reader.readAsDataURL(outputBlob);
      });
    }

    updateNodeData(node.id, {
      outputVideo,
      status: "complete",
      progress: 100,
      error: null,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      updateNodeData(node.id, { status: "idle", error: null, progress: 0 });
      throw err;
    }
    const errorMessage = err instanceof Error ? err.message : "Subtitle burn failed";
    updateNodeData(node.id, {
      status: "error",
      error: errorMessage,
      progress: 0,
    });
    throw err instanceof Error ? err : new Error(errorMessage);
  }
}
