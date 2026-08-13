-- node-banana metadata schema
-- Applied once inside the shared ParadeDB instance (database: nodebanana).
-- Extensions available in the ParadeDB image: vector, pg_search, pg_trgm, pgcrypto.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Workflows saved by the canvas (keyed by file path)
CREATE TABLE IF NOT EXISTS workflows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  file_path   text NOT NULL UNIQUE,
  content     jsonb NOT NULL,
  tags        text[] NOT NULL DEFAULT '{}',
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Generated media metadata; the binary itself stays on the file volume
CREATE TABLE IF NOT EXISTS generations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type   text NOT NULL CHECK (media_type IN ('image', 'video', 'model3d', 'audio')),
  prompt       text,
  provider     text,
  model        text,
  cost         numeric(10, 4),
  file_path    text NOT NULL,
  content_hash text,
  is_duplicate boolean NOT NULL DEFAULT false,
  -- Reserved for Phase 2 semantic search over prompts
  embedding    vector(768),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Fuzzy prompt search (pg_trgm); an HNSW vector index comes later once
-- embeddings are actually populated.
CREATE INDEX IF NOT EXISTS generations_prompt_trgm_idx
  ON generations USING gin (prompt gin_trgm_ops);

CREATE INDEX IF NOT EXISTS generations_media_type_idx ON generations (media_type);
CREATE INDEX IF NOT EXISTS generations_created_at_idx ON generations (created_at DESC);
CREATE INDEX IF NOT EXISTS generations_content_hash_idx ON generations (content_hash);

-- Curated/reusable prompts, seeded manually or promoted from generations
CREATE TABLE IF NOT EXISTS prompts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text,
  prompt      text NOT NULL,
  media_type  text,
  tags        text[] NOT NULL DEFAULT '{}',
  source_generation_id uuid REFERENCES generations (id) ON DELETE SET NULL,
  embedding   vector(768),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prompts_prompt_trgm_idx
  ON prompts USING gin (prompt gin_trgm_ops);
