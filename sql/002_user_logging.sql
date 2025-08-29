-- User input and interactions logging schema

-- 1) User input table: stores raw inputs
create table if not exists public.user_input (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  input_text  text not null,
  selected_mode text not null
);

-- 2) User interactions: stores matched quote id for each input
create table if not exists public.user_interactions (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  input_text    text not null,
  selected_mode text not null,
  quote_id      bigint not null references public.quote_embeddings(id)
);

-- Optional helper indexes
create index if not exists idx_user_input_created_at on public.user_input(created_at desc);
create index if not exists idx_user_interactions_created_at on public.user_interactions(created_at desc);
create index if not exists idx_user_interactions_quote_id on public.user_interactions(quote_id);

