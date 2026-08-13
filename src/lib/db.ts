/**
 * Metadata persistence layer for node-banana (NAS deployment)
 *
 * Design:
 * - If DATABASE_URL is not set, every function is a safe no-op, so local
 *   development without Postgres keeps working unchanged.
 * - All write functions catch their own errors and only log them; they must
 *   never fail a file-save response.
 * - The pg Pool is created lazily on first use.
 */

import { Pool } from "pg";
import { logger } from "@/utils/logger";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on("error", (err) => {
      logger.warn("system", "Postgres pool idle client error", {
        error: err.message,
      });
    });
  }
  return pool;
}

export function isDbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function dbHealth(): Promise<{ enabled: boolean; ok: boolean; error?: string }> {
  const p = getPool();
  if (!p) return { enabled: false, ok: false };
  try {
    await p.query("SELECT 1");
    return { enabled: true, ok: true };
  } catch (err) {
    return {
      enabled: true,
      ok: false,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

export interface GenerationRecord {
  mediaType: "image" | "video" | "model3d" | "audio";
  prompt?: string | null;
  provider?: string | null;
  model?: string | null;
  cost?: number | null;
  filePath: string;
  contentHash?: string | null;
  isDuplicate?: boolean;
}

/**
 * Record a generated media file's metadata.
 * Failures are logged and swallowed by design.
 */
export async function recordGeneration(rec: GenerationRecord): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `INSERT INTO generations (media_type, prompt, provider, model, cost, file_path, content_hash, is_duplicate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        rec.mediaType,
        rec.prompt ?? null,
        rec.provider ?? null,
        rec.model ?? null,
        rec.cost ?? null,
        rec.filePath,
        rec.contentHash ?? null,
        rec.isDuplicate ?? false,
      ]
    );
  } catch (err) {
    logger.warn("system", "Failed to record generation metadata (non-fatal)", {
      filePath: rec.filePath,
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
}

/**
 * Upsert a workflow definition, keyed by its file path.
 * Stores the full JSON content plus a display name for browsing.
 */
export async function upsertWorkflow(input: {
  name: string;
  filePath: string;
  content: unknown;
}): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `INSERT INTO workflows (name, file_path, content, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (file_path)
       DO UPDATE SET name = EXCLUDED.name, content = EXCLUDED.content, updated_at = now()`,
      [input.name, input.filePath, JSON.stringify(input.content)]
    );
  } catch (err) {
    logger.warn("system", "Failed to upsert workflow metadata (non-fatal)", {
      filePath: input.filePath,
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
}
