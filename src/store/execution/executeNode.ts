/**
 * Central node dispatcher.
 *
 * Maps a node's type to the correct executor function, eliminating the
 * duplicated switch/if-else chains that previously existed in
 * executeWorkflow, regenerateNode, and executeSelectedNodes.
 */

import type { NodeExecutionContext } from "./types";
import type { NanoBananaNodeData, SelectedModel } from "@/types";
import {
  executeAnnotation,
  executeArray,
  executePrompt,
  executePromptConstructor,
  executeOutput,
  executeOutputGallery,
  executeImageCompare,
  executeGlbViewer,
} from "./simpleNodeExecutors";
import { executeNanoBanana } from "./nanoBananaExecutor";
import { executeGenerateVideo } from "./generateVideoExecutor";
import { executeGenerate3D } from "./generate3dExecutor";
import { executeLlmGenerate } from "./llmGenerateExecutor";
import { executeSplitGrid } from "./splitGridExecutor";
import { executeVideoStitch, executeEaseCurve, executeVideoTrim, executeVideoFrameGrab } from "./videoProcessingExecutors";
import { executeRemoveBackground } from "./removeBackgroundExecutor";
import { executeImageResize, executeGifEncoder } from "./imageProcessingExecutors";
import { executeGenerateAudio } from "./generateAudioExecutor";
import { executeComfyApp } from "./comfyAppExecutor";
import { executeTranscribe } from "./transcribeExecutor";
import { executeSubtitleBurn } from "./subtitleBurnExecutor";
import { addRecentModel } from "@/store/utils/localStorage";

/** Track the selected model for recently-used Quick Access. */
function trackRecentModel(data: Record<string, unknown>): void {
  const sm = data.selectedModel as SelectedModel | undefined;
  if (sm?.provider && sm?.modelId && sm?.displayName) {
    addRecentModel({ provider: sm.provider, modelId: sm.modelId, displayName: sm.displayName });
  }
}

export interface ExecuteNodeOptions {
  /** When true, executors that support it will fall back to stored inputs. */
  useStoredFallback?: boolean;
}

/**
 * Execute a single node by dispatching to the appropriate executor.
 *
 * Data-source node types (`imageInput`, `audioInput`, `videoInput`) are no-ops.
 */
export async function executeNode(
  ctx: NodeExecutionContext,
  options?: ExecuteNodeOptions,
): Promise<void> {
  const regenOpts = options?.useStoredFallback ? { useStoredFallback: true } : undefined;

  switch (ctx.node.type) {
    case "imageInput":
      // Data source node — no execution needed
      break;
    case "audioInput": {
      // If audio is connected from upstream, use it (connection wins over upload)
      const audioInputs = ctx.getConnectedInputs(ctx.node.id);
      if (audioInputs.audio.length > 0 && audioInputs.audio[0]) {
        ctx.updateNodeData(ctx.node.id, { audioFile: audioInputs.audio[0] });
      }
      break;
    }
    case "videoInput": {
      // If video is connected from upstream, use it (connection wins over upload)
      const videoInputs = ctx.getConnectedInputs(ctx.node.id);
      if (videoInputs.videos.length > 0 && videoInputs.videos[0]) {
        ctx.updateNodeData(ctx.node.id, { video: videoInputs.videos[0] });
      }
      break;
    }
    case "annotation":
      await executeAnnotation(ctx);
      break;
    case "prompt":
      await executePrompt(ctx);
      break;
    case "array":
      await executeArray(ctx);
      break;
    case "promptConstructor":
      await executePromptConstructor(ctx);
      break;
    case "nanoBanana": {
      trackRecentModel(ctx.node.data as Record<string, unknown>);
      // Runs × N (Weavy parity): execute the generation N times; each result
      // is appended to the node's imageHistory carousel by the executor.
      const freshNanoNode = ctx.getFreshNode(ctx.node.id);
      const requestedRuns = (freshNanoNode?.data as NanoBananaNodeData | undefined)?.runs ?? 1;
      const runs = Math.min(4, Math.max(1, Math.floor(requestedRuns)));
      for (let runIndex = 0; runIndex < runs; runIndex++) {
        if (ctx.signal?.aborted) break;
        await executeNanoBanana(ctx, regenOpts);
      }
      break;
    }
    case "generateVideo":
      trackRecentModel(ctx.node.data as Record<string, unknown>);
      await executeGenerateVideo(ctx, regenOpts);
      break;
    case "generate3d":
      trackRecentModel(ctx.node.data as Record<string, unknown>);
      await executeGenerate3D(ctx, regenOpts);
      break;
    case "generateAudio":
      trackRecentModel(ctx.node.data as Record<string, unknown>);
      await executeGenerateAudio(ctx, regenOpts);
      break;
    case "llmGenerate":
      await executeLlmGenerate(ctx, regenOpts);
      break;
    case "splitGrid":
      await executeSplitGrid(ctx);
      break;
    case "output":
      await executeOutput(ctx);
      break;
    case "outputGallery":
      await executeOutputGallery(ctx);
      break;
    case "imageCompare":
      await executeImageCompare(ctx);
      break;
    case "videoStitch":
      await executeVideoStitch(ctx);
      break;
    case "easeCurve":
      await executeEaseCurve(ctx);
      break;
    case "videoTrim":
      await executeVideoTrim(ctx);
      break;
    case "glbViewer":
      await executeGlbViewer(ctx);
      break;
    case "videoFrameGrab":
      await executeVideoFrameGrab(ctx);
      break;
    case "removeBackground":
      await executeRemoveBackground(ctx);
      break;
    case "imageResize":
      await executeImageResize(ctx);
      break;
    case "gifEncoder":
      await executeGifEncoder(ctx);
      break;
    case "comfyApp":
      await executeComfyApp(ctx);
      break;
    case "transcribe":
      await executeTranscribe(ctx);
      break;
    case "subtitleBurn":
      await executeSubtitleBurn(ctx);
      break;
  }
}
