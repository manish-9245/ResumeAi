# ResumeAI

ResumeAI is a full-stack Next.js + Supabase + Mastra application for resume parsing, job fit analysis, skill-gap roadmap planning, resume improvement, and skill verification quizzes.

## Tech Stack

- **Frontend + API**: Next.js App Router, TypeScript, Tailwind CSS
- **Database/Auth/Storage**: Supabase (PostgreSQL, Auth, Storage, pgvector)
- **AI Orchestration**: Mastra agents, tools, workflows
- **LLM Provider**: Google Gemini (`google/gemini-2.5-flash`)

## Features

1. **Resume Upload + Parsing**
   - Upload PDF resumes
   - Store files in Supabase Storage bucket `resumes`
   - Extract text from PDF, parse with Mastra agent + strict Zod schema
   - Compute deterministic resume health score
2. **Job Match + Skill Gap Analysis**
   - Compare parsed profile vs target job description
   - Return overall score, matching/partial/missing skills, and priorities
3. **Roadmap + What-If Simulation**
   - Generate step-by-step learning roadmap
   - Run hypothetical “What if I learn X?” score simulation
4. **AI Resume Improvement**
   - Generate grounded wording and presentation recommendations
5. **Skill Verification Quiz**
   - Generate dynamic quiz questions based on claimed skills
   - Score answers, verify strengths, and persist results
6. **Career Readiness Dashboard**
   - Show average resume health, match scores, quiz score, and next skill gaps

## Project Structure

- `src/app` - Pages and API routes
- `src/lib` - Environment, auth, Supabase clients, data access
- `src/mastra` - Mastra schemas, agents, tools, workflow, service layer
- `supabase/migrations/001_resumeai_schema.sql` - Database + RLS + storage policies

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env.local
```

3. Fill values in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_API_KEY`

4. Run SQL migration in Supabase SQL editor:

- `supabase/migrations/001_resumeai_schema.sql`

5. Start app:

```bash
npm run dev
```

## Auth Flow

- Email magic link sign-in using Supabase Auth
- Callback route: `/auth/callback`
- Protected page: `/dashboard`

## API Routes

- `POST /api/resume/upload`
- `GET /api/resumes`
- `POST /api/job-match`
- `POST /api/roadmap`
- `POST /api/simulate-skill`
- `POST /api/improve-resume`
- `POST /api/quiz/generate`
- `POST /api/quiz/submit`
- `GET /api/dashboard`

## Production Notes

- Resume parsing and all AI output are schema-validated with Zod.
- Storage paths are user-scoped to enforce ownership.
- Database access patterns are aligned with RLS policies.
- Service role key is only used on the server.
