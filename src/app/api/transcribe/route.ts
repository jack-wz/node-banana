import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/utils/logger";

export const maxDuration = 300; // 5 minute timeout — ASR on longer clips can take a while

function generateRequestId(): string {
  return `transcribe-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export interface TranscribeResponse {
  success: boolean;
  srt?: string;
  error?: string;
}

/**
 * Transcribe an audio/video file into plain SRT via OpenAI's Whisper
 * transcription endpoint. This does ASR only — no styling, no burn-in.
 * The caller (transcribe node) hands the resulting SRT text to a
 * subtitleBurn node for formatting and rendering.
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const apiKey = request.headers.get("X-OpenAI-API-Key") || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.error('api.error', 'OPENAI_API_KEY not configured', { requestId });
      return NextResponse.json<TranscribeResponse>(
        {
          success: false,
          error: "OpenAI API key required. Add OPENAI_API_KEY to .env.local or configure in Settings.",
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const language = formData.get("language");

    if (!(file instanceof Blob)) {
      return NextResponse.json<TranscribeResponse>(
        { success: false, error: "No audio/video file provided" },
        { status: 400 }
      );
    }

    logger.info('api.transcribe', 'Transcription request received', {
      requestId,
      fileType: file.type,
      fileSize: file.size,
      language,
    });

    const upstreamForm = new FormData();
    // Whisper infers container/codec from the filename extension; the
    // node's client-side audio extraction always produces webm/opus.
    upstreamForm.append("file", file, "audio.webm");
    upstreamForm.append("model", "whisper-1");
    upstreamForm.append("response_format", "srt");
    if (typeof language === "string" && language !== "auto" && language.length > 0) {
      upstreamForm.append("language", language);
    }

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('api.error', 'OpenAI transcription request failed', {
        requestId,
        status: response.status,
        errorText: errorText.substring(0, 500),
      });
      let errorMessage = `Transcription failed (HTTP ${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        // Non-JSON error body; keep the generic message.
      }
      return NextResponse.json<TranscribeResponse>(
        { success: false, error: errorMessage },
        { status: response.status }
      );
    }

    const srt = await response.text();

    logger.info('api.transcribe', 'Transcription successful', {
      requestId,
      srtLength: srt.length,
    });

    return NextResponse.json<TranscribeResponse>({ success: true, srt });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Transcription failed";
    logger.error('api.error', 'Transcription request error', { requestId, error: errorMessage });
    return NextResponse.json<TranscribeResponse>(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
