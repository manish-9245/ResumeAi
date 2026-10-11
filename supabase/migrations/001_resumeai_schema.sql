create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  raw_text text not null,
  parsed_profile jsonb not null,
  resume_health_score integer not null check (resume_health_score between 0 and 100),
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  job_description text not null,
  overall_score integer not null check (overall_score between 0 and 100),
  summary text not null,
  matching_skills text[] not null default '{}',
  partial_skills jsonb not null default '[]'::jsonb,
  missing_skills jsonb not null default '[]'::jsonb,
  suggested_resume_focus text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.learning_roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null references public.job_analyses(id) on delete cascade,
  roadmap_title text not null,
  milestones jsonb not null default '[]'::jsonb,
  estimated_readiness_score integer not null check (estimated_readiness_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.skill_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null references public.job_analyses(id) on delete cascade,
  simulated_skill text not null,
  simulated_score integer not null check (simulated_score between 0 and 100),
  delta integer not null,
  assumptions jsonb not null default '[]'::jsonb,
  updated_missing_skills jsonb not null default '[]'::jsonb,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.resume_improvements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  analysis_id uuid not null references public.job_analyses(id) on delete cascade,
  strengths text[] not null default '{}',
  wording_improvements jsonb not null default '[]'::jsonb,
  presentation_enhancements text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  status text not null check (status in ('generated', 'completed')),
  score_percentage integer check (score_percentage between 0 and 100),
  verified_skills text[] not null default '{}',
  needs_practice_skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  skill text not null,
  question_type text not null check (question_type in ('mcq', 'short_answer')),
  question_text text not null,
  options text[] not null default '{}',
  correct_answer text not null,
  explanation text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_text text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_resumes_user_id on public.resumes(user_id);
create index if not exists idx_job_analyses_user_id on public.job_analyses(user_id);
create index if not exists idx_learning_roadmaps_user_id on public.learning_roadmaps(user_id);
create index if not exists idx_skill_simulations_user_id on public.skill_simulations(user_id);
create index if not exists idx_resume_improvements_user_id on public.resume_improvements(user_id);
create index if not exists idx_quiz_sessions_user_id on public.quiz_sessions(user_id);
create index if not exists idx_quiz_answers_user_id on public.quiz_answers(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_resumes_updated_at on public.resumes;
create trigger set_resumes_updated_at
before update on public.resumes
for each row
execute function public.set_updated_at();

alter table public.resumes enable row level security;
alter table public.job_analyses enable row level security;
alter table public.learning_roadmaps enable row level security;
alter table public.skill_simulations enable row level security;
alter table public.resume_improvements enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answers enable row level security;

create policy "Users can manage own resumes"
on public.resumes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own job analyses"
on public.job_analyses
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own roadmaps"
on public.learning_roadmaps
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own simulations"
on public.skill_simulations
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own improvements"
on public.resume_improvements
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own quiz sessions"
on public.quiz_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own quiz questions"
on public.quiz_questions
for select
using (
  exists (
    select 1 from public.quiz_sessions
    where public.quiz_sessions.id = public.quiz_questions.session_id
      and public.quiz_sessions.user_id = auth.uid()
  )
);

create policy "Users can manage own quiz answers"
on public.quiz_answers
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "Users can upload own resumes"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can read own resumes"
on storage.objects
for select
to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own resumes"
on storage.objects
for delete
to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
