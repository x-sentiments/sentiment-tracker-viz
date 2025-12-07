-- Migration: Add fields required by evidence-softmax-v1 formula
-- - prior_probability on outcomes
-- - post_created_at, author_created_at, features on raw_posts

-- Add prior_probability to outcomes (for new/unexpected outcomes)
alter table public.outcomes
  add column if not exists prior_probability double precision;

-- Add post creation timestamp (from X) for time decay calculations
alter table public.raw_posts
  add column if not exists post_created_at timestamptz;

-- Add author account creation timestamp (optional, helps credibility)
alter table public.raw_posts
  add column if not exists author_created_at timestamptz;

-- Add extracted features for spam detection (cashtag_count, url_count, etc.)
alter table public.raw_posts
  add column if not exists features jsonb;

-- Add flags from Grok scoring to scored_posts (is_sarcasm, is_question, etc.)
alter table public.scored_posts
  add column if not exists flags jsonb;

-- Index for time-decay queries on post_created_at
create index if not exists idx_raw_posts_market_post_created
  on public.raw_posts(market_id, post_created_at desc);

-- RLS policies for public reads
-- Markets: public read
alter table public.markets enable row level security;
drop policy if exists "Markets are viewable by everyone" on public.markets;
create policy "Markets are viewable by everyone"
  on public.markets for select using (true);

-- Outcomes: public read
alter table public.outcomes enable row level security;
drop policy if exists "Outcomes are viewable by everyone" on public.outcomes;
create policy "Outcomes are viewable by everyone"
  on public.outcomes for select using (true);

-- Market state: public read
alter table public.market_state enable row level security;
drop policy if exists "Market state is viewable by everyone" on public.market_state;
create policy "Market state is viewable by everyone"
  on public.market_state for select using (true);

-- Probability snapshots: public read
alter table public.probability_snapshots enable row level security;
drop policy if exists "Probability snapshots are viewable by everyone" on public.probability_snapshots;
create policy "Probability snapshots are viewable by everyone"
  on public.probability_snapshots for select using (true);

-- Raw posts: public read (for display purposes)
alter table public.raw_posts enable row level security;
drop policy if exists "Raw posts are viewable by everyone" on public.raw_posts;
create policy "Raw posts are viewable by everyone"
  on public.raw_posts for select using (true);

-- Scored posts: public read (for curated post display)
alter table public.scored_posts enable row level security;
drop policy if exists "Scored posts are viewable by everyone" on public.scored_posts;
create policy "Scored posts are viewable by everyone"
  on public.scored_posts for select using (true);

-- Market X rules: public read
alter table public.market_x_rules enable row level security;
drop policy if exists "Market X rules are viewable by everyone" on public.market_x_rules;
create policy "Market X rules are viewable by everyone"
  on public.market_x_rules for select using (true);

