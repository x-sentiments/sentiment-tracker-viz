create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  normalized_question text,
  status text not null default 'active' check (status in ('active','closed','resolved')),
  created_at timestamptz not null default now(),
  x_rule_templates jsonb,
  total_posts_processed integer default 0
);

create unique index if not exists idx_markets_normalized_question on public.markets using btree (normalized_question);

-- Outcomes
create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id text not null,
  label text not null,
  current_probability double precision default 0,
  cumulative_support double precision default 0,
  cumulative_oppose double precision default 0,
  post_count integer default 0
);

create index if not exists idx_outcomes_market on public.outcomes(market_id);

-- Market X rules (per market)
create table if not exists public.market_x_rules (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  rule text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_market_x_rules_market on public.market_x_rules(market_id);

-- Raw posts (ingested)
create table if not exists public.raw_posts (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  x_post_id text not null,
  ingested_at timestamptz not null default now(),
  expires_at timestamptz,
  text text not null,
  author_id text,
  author_followers integer,
  author_verified boolean,
  metrics jsonb,
  is_active boolean default true
);

create unique index if not exists idx_raw_posts_unique_x_post on public.raw_posts(x_post_id, market_id);
create index if not exists idx_raw_posts_market_ingested on public.raw_posts(market_id, ingested_at desc);

-- Scored posts (per outcome per post)
create table if not exists public.scored_posts (
  id uuid primary key default gen_random_uuid(),
  raw_post_id uuid not null references public.raw_posts(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id text not null,
  scores jsonb not null,
  scored_at timestamptz not null default now(),
  display_labels jsonb
);

create unique index if not exists idx_scored_posts_unique on public.scored_posts(raw_post_id, market_id, outcome_id);
create index if not exists idx_scored_posts_market_time on public.scored_posts(market_id, scored_at desc);

-- Probability snapshots
create table if not exists public.probability_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  timestamp timestamptz not null default now(),
  probabilities jsonb not null
);

create index if not exists idx_snapshots_market_time on public.probability_snapshots(market_id, timestamp desc);

-- Market state (current probabilities)
create table if not exists public.market_state (
  market_id uuid primary key references public.markets(id) on delete cascade,
  probabilities jsonb not null,
  updated_at timestamptz not null default now(),
  post_counts integer default 0
);


