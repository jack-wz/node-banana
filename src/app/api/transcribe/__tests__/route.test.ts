import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST } from "../route";

const originalEnv = { ...process.env };
const mockFetch = vi.fn();

// The route only reads request.headers and request.formData(). Real multipart
// parsing (undici Request.formData()) is broken under the jsdom test realm
// (undici's internal File/FormData instanceof checks reject jsdom globals),
// so tests stub formData() directly; production Next.js parses multipart fine.
function createMockRequest(options: {
  withFile?: boolean;
  language?: string;
  headers?: Record<string, string>;
} = {}): NextRequest {
  const { withFile = true, language, headers = {} } = options;
  const formData = new FormData();
  if (withFile) {
    formData.append("file", new Blob(["audio"], { type: "audio/wav" }), "audio.wav");
  }
  if (language) {
    formData.append("language", language);
  }
  return {
    headers: new Headers(headers),
    formData: () => Promise.resolve(formData),
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("POST /api/transcribe", () => {
  it("rejects when no API key is available", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(createMockRequest());
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("OpenAI API key");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects when no file is provided", async () => {
    process.env.OPENAI_API_KEY = "sk-env";
    const response = await POST(createMockRequest({ withFile: false }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("No audio/video file");
  });

  it("forwards the file to OpenAI and returns SRT", async () => {
    process.env.OPENAI_API_KEY = "sk-env";
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("1\n00:00:00,000 --> 00:00:01,000\nHi"),
    });

    const response = await POST(createMockRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.srt).toContain("00:00:00,000");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.headers.Authorization).toBe("Bearer sk-env");
    expect((init.body as FormData).get("model")).toBe("whisper-1");
    expect((init.body as FormData).get("response_format")).toBe("srt");
  });

  it("user-provided header key takes precedence over env", async () => {
    process.env.OPENAI_API_KEY = "sk-env";
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("srt") });

    await POST(createMockRequest({ headers: { "X-OpenAI-API-Key": "sk-user" } }));

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer sk-user");
  });

  it("passes a language hint when one is selected", async () => {
    process.env.OPENAI_API_KEY = "sk-env";
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("srt") });

    await POST(createMockRequest({ language: "zh" }));

    const [, init] = mockFetch.mock.calls[0];
    expect((init.body as FormData).get("language")).toBe("zh");
  });

  it("omits the language field when set to auto", async () => {
    process.env.OPENAI_API_KEY = "sk-env";
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("srt") });

    await POST(createMockRequest({ language: "auto" }));

    const [, init] = mockFetch.mock.calls[0];
    expect((init.body as FormData).get("language")).toBeNull();
  });

  it("surfaces upstream OpenAI errors", async () => {
    process.env.OPENAI_API_KEY = "sk-env";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(JSON.stringify({ error: { message: "Rate limited" } })),
    });

    const response = await POST(createMockRequest());
    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Rate limited");
  });
});
