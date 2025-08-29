-- pgvector + quotes embedding table + RPCs
-- Run this in Supabase SQL Editor (or psql).

-- 1) Vector extension
create extension if not exists vector;

-- 2) Embeddings table (Google text-embedding-004 => 768 dims)
create table if not exists public.quote_embeddings (
  id        bigserial primary key,
  quote     text not null,
  author    text not null,
  source    text not null,
  emotion   text[] not null default '{}',
  embedding vector(768) not null
);

-- 3) Vector index (cosine). Tune lists based on data size.
create index if not exists quote_embeddings_embedding_ivfflat
  on public.quote_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Optional: increase probe count for better recall (session-level)
-- select set_config('ivfflat.probes', '10', true);

-- 4) RPC: match_quotes (used by scripts/testRpc.ts)
create or replace function public.match_quotes(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  quote text,
  author text,
  source text,
  similarity float
)
language sql stable as $$
  select
    id,
    quote,
    author,
    source,
    1 - (embedding <=> query_embedding) as similarity
  from public.quote_embeddings
  where 1 - (embedding <=> query_embedding) >= match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 5) RPC: match_quote_embeddings (used by src/services/ragService.ts)
create or replace function public.match_quote_embeddings(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  quote text,
  author text,
  source text,
  similarity float
)
language sql stable as $$
  select * from public.match_quotes(query_embedding, match_threshold, match_count);
$$;

-- Done.

