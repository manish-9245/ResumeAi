-- ResumeAI Supabase schema — per-user isolation via RLS.
-- Run in Supabase SQL editor. Each user only ever sees their own rows.
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  email text,
  resume_text text,
  parsed jsonb default '{}'::jsonb,
  health jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  title text,
  company text,
  jd text,
  jd_hash text,
  strategy text,
  result jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Cached resume analyses, deduped by content hash (saves Gemini tokens on re-upload).
create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_hash text not null,
  resume_text text,
  parsed jsonb default '{}'::jsonb,
  health jsonb default '{}'::jsonb,
  ai_note text,
  created_at timestamptz default now(),
  unique(user_id, resume_hash)
);

-- Saved learning roadmaps, optionally pinned to one compared job.
create table if not exists roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_match_id uuid references job_matches(id) on delete set null,
  title text,
  gaps jsonb default '[]'::jsonb,
  steps jsonb default '[]'::jsonb,
  cache_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Quiz attempts: metrics + full review, addressable at /quiz/[id].
create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topics jsonb default '[]'::jsonb,
  count int default 6,
  questions jsonb default '[]'::jsonb,
  answers jsonb default '{}'::jsonb,
  score int default 0,
  created_at timestamptz default now()
);

-- Generic AI-result cache (e.g. resume wording rewrites), keyed by caller.
create table if not exists ai_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  primary key (user_id, key)
);

-- One canonical profile row per user (enables last-write-wins sync).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_user_unique') then
    alter table profiles add constraint profiles_user_unique unique(user_id);
  end if;
end $$;

-- Chat sessions (synced so conversations survive across devices).
create table if not exists chat_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  messages jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
alter table job_matches enable row level security;
alter table analyses enable row level security;
alter table roadmaps enable row level security;
alter table quiz_attempts enable row level security;
alter table ai_cache enable row level security;

-- Drop legacy demo-open policies if they exist:
drop policy if exists "open read" on profiles;
drop policy if exists "open write" on profiles;
drop policy if exists "open update" on profiles;
drop policy if exists "profiles_owner_read" on profiles;
drop policy if exists "profiles_owner_write" on profiles;
drop policy if exists "profiles_owner_update" on profiles;
drop policy if exists "profiles_owner_delete" on profiles;
drop policy if exists "matches_owner_read" on job_matches;
drop policy if exists "matches_owner_write" on job_matches;
drop policy if exists "matches_owner_update" on job_matches;
drop policy if exists "matches_owner_delete" on job_matches;
drop policy if exists "analyses_owner_read" on analyses;
drop policy if exists "analyses_owner_write" on analyses;
drop policy if exists "analyses_owner_update" on analyses;
drop policy if exists "analyses_owner_delete" on analyses;
drop policy if exists "roadmaps_owner_read" on roadmaps;
drop policy if exists "roadmaps_owner_write" on roadmaps;
drop policy if exists "roadmaps_owner_update" on roadmaps;
drop policy if exists "roadmaps_owner_delete" on roadmaps;
drop policy if exists "attempts_owner_read" on quiz_attempts;
drop policy if exists "attempts_owner_write" on quiz_attempts;
drop policy if exists "attempts_owner_update" on quiz_attempts;
drop policy if exists "attempts_owner_delete" on quiz_attempts;
drop policy if exists "aicache_owner_read" on ai_cache;
drop policy if exists "aicache_owner_write" on ai_cache;
drop policy if exists "aicache_owner_update" on ai_cache;
drop policy if exists "aicache_owner_delete" on ai_cache;
drop policy if exists "chats_owner_read" on chat_sessions;
drop policy if exists "chats_owner_write" on chat_sessions;
drop policy if exists "chats_owner_update" on chat_sessions;
drop policy if exists "chats_owner_delete" on chat_sessions;

-- Owner-only policies: separation of data by auth.uid().
create policy "profiles_owner_read" on profiles for select using (auth.uid() = user_id);
create policy "profiles_owner_write" on profiles for insert with check (auth.uid() = user_id);
create policy "profiles_owner_update" on profiles for update using (auth.uid() = user_id);
create policy "profiles_owner_delete" on profiles for delete using (auth.uid() = user_id);

create policy "matches_owner_read" on job_matches for select using (auth.uid() = user_id);
create policy "matches_owner_write" on job_matches for insert with check (auth.uid() = user_id);
create policy "matches_owner_update" on job_matches for update using (auth.uid() = user_id);
create policy "matches_owner_delete" on job_matches for delete using (auth.uid() = user_id);

create policy "analyses_owner_read" on analyses for select using (auth.uid() = user_id);
create policy "analyses_owner_write" on analyses for insert with check (auth.uid() = user_id);
create policy "analyses_owner_update" on analyses for update using (auth.uid() = user_id);
create policy "analyses_owner_delete" on analyses for delete using (auth.uid() = user_id);

create policy "roadmaps_owner_read" on roadmaps for select using (auth.uid() = user_id);
create policy "roadmaps_owner_write" on roadmaps for insert with check (auth.uid() = user_id);
create policy "roadmaps_owner_update" on roadmaps for update using (auth.uid() = user_id);
create policy "roadmaps_owner_delete" on roadmaps for delete using (auth.uid() = user_id);

create policy "attempts_owner_read" on quiz_attempts for select using (auth.uid() = user_id);
create policy "attempts_owner_write" on quiz_attempts for insert with check (auth.uid() = user_id);
create policy "attempts_owner_update" on quiz_attempts for update using (auth.uid() = user_id);
create policy "attempts_owner_delete" on quiz_attempts for delete using (auth.uid() = user_id);

create policy "aicache_owner_read" on ai_cache for select using (auth.uid() = user_id);
create policy "aicache_owner_write" on ai_cache for insert with check (auth.uid() = user_id);
create policy "aicache_owner_update" on ai_cache for update using (auth.uid() = user_id);
create policy "aicache_owner_delete" on ai_cache for delete using (auth.uid() = user_id);

alter table chat_sessions enable row level security;

create policy "chats_owner_read" on chat_sessions for select using (auth.uid() = user_id);
create policy "chats_owner_write" on chat_sessions for insert with check (auth.uid() = user_id);
create policy "chats_owner_update" on chat_sessions for update using (auth.uid() = user_id);
create policy "chats_owner_delete" on chat_sessions for delete using (auth.uid() = user_id);

create index if not exists profiles_user_idx on profiles(user_id, updated_at desc);
create index if not exists matches_user_idx on job_matches(user_id, created_at desc);
create index if not exists matches_hash_idx on job_matches(user_id, jd_hash);
create index if not exists analyses_hash_idx on analyses(user_id, resume_hash);
create index if not exists roadmaps_user_idx on roadmaps(user_id, created_at desc);
create index if not exists attempts_user_idx on quiz_attempts(user_id, created_at desc);
create index if not exists chats_user_idx on chat_sessions(user_id, updated_at desc);
