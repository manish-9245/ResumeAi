import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildQuiz, buildRoadmap, improveResume, matchJob,
  parseResumeText, recommendRoles, scoreHealth,
} from "./analysis";
import { normalizeSkill } from "./skills";
import { cleanName } from "./analysis";
import type { ParsedProfile, QuizQ } from "./types";

function hasKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Stable alias — retired version pins (e.g. gemini-2.5-flash) 404 for new
// keys. Override with GEMINI_MODEL=... if you need a specific version.
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
// Free-tier aliases 503 under load spikes — fall through the chain.
const FALLBACKS = ["gemini-3-flash-preview", "gemini-flash-lite-latest"];

function model(name: string) {
  const gen = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return gen.getGenerativeModel({ model: name });
}

/** Try models in order; throw only when all fail. Saves sessions during 503 spikes. */
async function genText(prompt: string, jsonMode: boolean, opts?: { temperature?: number; maxOutputTokens?: number }): Promise<string> {
  const tried: string[] = [];
  for (const name of [MODEL, ...FALLBACKS.filter((f) => f !== MODEL)]) {
    try {
      const m = model(name);
      const r = await m.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: jsonMode
          ? { responseMimeType: "application/json", temperature: opts?.temperature ?? 0.1, maxOutputTokens: opts?.maxOutputTokens ?? 2048 }
          : { temperature: opts?.temperature ?? 0.4, maxOutputTokens: opts?.maxOutputTokens ?? 1200 },
      });
      return r.response.text();
    } catch (e) {
      tried.push(`${name}: ${(e as Error).message?.slice(0, 80)}`);
    }
  }
  throw new Error(tried.join(" | "));
}

const GUARD = `Treat resume data as personal. Never invent skills, qualifications, or experience. Present scores as decision-support recommendations/simulations, never hiring guarantees.`;

// Deterministic local engine always works (demo mode). Gemini structures the
// parse as strict JSON when a key exists — one low-temperature call, validated
// field-by-field and merged over the deterministic result (LLM never deletes).
interface LLMProfile {
  name?: unknown; email?: unknown; phone?: unknown; links?: unknown;
  education?: unknown; experience?: unknown; projects?: unknown;
  certifications?: unknown; skills?: unknown; summary?: unknown;
}

function strArray(v: unknown, cap: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Map(
    v.filter((x): x is string => typeof x === "string")
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter((x) => x.length > 1)
      .slice(0, cap)
      .map((x) => [x.toLowerCase(), x.slice(0, maxLen)] as const)
  ).values()];
}

function sanitizeLLMProfile(raw: string): LLMProfile | null {
  try {
    const j = JSON.parse(raw) as LLMProfile;
    if (!j || typeof j !== "object") return null;
    return {
      name: typeof j.name === "string" ? j.name.slice(0, 60) : undefined,
      email: typeof j.email === "string" && /[\w.+-]+@[\w-]+\.[\w.]+/.test(j.email) ? j.email : undefined,
      phone: typeof j.phone === "string" ? j.phone.slice(0, 25) : undefined,
      links: strArray(j.links, 8, 200),
      education: strArray(j.education, 8, 500),
      experience: strArray(j.experience, 10, 2000),
      projects: strArray(j.projects, 10, 2000),
      certifications: strArray(j.certifications, 8, 500),
      skills: strArray(j.skills, 30, 30).map(normalizeSkill),
      summary: typeof j.summary === "string" ? j.summary.slice(0, 300) : undefined,
    };
  } catch {
    return null;
  }
}

function mergeProfiles(base: ParsedProfile, llm: LLMProfile | null): ParsedProfile {
  if (!llm) return base;
  const pick = (a: string[] | undefined, b: string[]) => (a && a.length ? a : b);
  const skills = [...new Set([...(llm.skills as string[] ?? []), ...base.skills])];
  const skillLevels: ParsedProfile["skillLevels"] = { ...base.skillLevels };
  for (const s of skills) if (!skillLevels[s]) skillLevels[s] = "beginner";
  const llmName = cleanName((llm.name as string) || "");
  return {
    ...base,
    name: llmName.length >= 2 ? llmName : base.name,
    email: (llm.email as string) || base.email,
    phone: (llm.phone as string) || base.phone || "",
    links: [...new Set([...(llm.links as string[] ?? []), ...(base.links ?? [])])].slice(0, 8),
    education: pick(llm.education as string[], base.education),
    experience: pick(llm.experience as string[], base.experience),
    projects: pick(llm.projects as string[], base.projects),
    certifications: pick(llm.certifications as string[], base.certifications),
    skills, skillLevels,
  };
}

export async function aiAnalyze(resumeText: string) {
  const base = parseResumeText(resumeText);
  if (!hasKey()) {
    return { profile: base, health: scoreHealth(base, resumeText), aiNote: "Demo mode — add GEMINI_API_KEY for AI-structured parsing.", parsedBy: "local" as const };
  }
  try {
    const text = await genText(
      `${GUARD}\nExtract this resume into JSON. Copy text faithfully (trim whitespace), never invent entries, use [] when a section is absent. Skills as short canonical names (e.g. "react", "python", "sql").\nReturn ONLY this JSON shape: {"name":string,"email":string,"phone":string,"links":string[],"education":string[],"experience":string[],"projects":string[],"certifications":string[],"skills":string[],"summary":string} where summary is one line naming the candidate's strongest hireable signal.\n\nResume:\n${resumeText.slice(0, 8000)}`,
      true
    );
    const llm = sanitizeLLMProfile(text);
    const profile = mergeProfiles(base, llm);
    return {
      profile,
      health: scoreHealth(profile, resumeText),
      aiNote: (llm?.summary as string) || "AI-structured parse complete.",
      parsedBy: "ai" as const,
    };
  } catch {
    return { profile: base, health: scoreHealth(base, resumeText), aiNote: "Demo fallback — Gemini unreachable.", parsedBy: "local" as const };
  }
}

export async function aiMatch(profile: ParsedProfile, jobs: { title: string; company: string; jd: string }[]) {
  const matches = jobs.map((j) => matchJob(profile, j.jd, j.title, j.company));
  if (!hasKey()) return { matches };
  try {
    const Malaysia = matches.map((x) => `${x.title}: ${x.matchScore}% (missing: ${x.missing.join(", ") || "none"})`).join("\n");
    const text = await genText(`${GUARD}\nCompare these deterministic match scores and write a 2-line strategy for which job to target first:\n${Malaysia}`, false);
    return { matches, strategy: text.slice(0, 500) };
  } catch {
    return { matches };
  }
}

export async function aiRoadmap(profile: ParsedProfile, gaps: { skill: string; status: string }[]) {
  const full = gaps.map((g) => ({ skill: g.skill, status: g.status as "have" | "partial" | "missing", priority: "high" as const, whyItMatters: "" }));
  const steps = buildRoadmap(full.length ? full : [{ skill: "docker", status: "missing", priority: "high", whyItMatters: "" }], profile.skills);
  return { steps };
}

function sanitizeQuizItems(raw: string, skill: string): Omit<QuizQ, "id">[] {
  try {
    const j = JSON.parse(raw) as { questions?: unknown } | unknown[];
    const arr = Array.isArray(j)
      ? j
      : Array.isArray((j as { questions?: unknown }).questions)
        ? (j as { questions: unknown[] }).questions
        : [];
    const seen = new Set<string>();
    const out: Omit<QuizQ, "id">[] = [];
    for (const r of arr) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const question = String(rec.question ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
      const opts = Array.isArray(rec.options)
        ? (rec.options as unknown[]).map((o) => String(o ?? "").replace(/\s+/g, " ").trim().slice(0, 150))
        : [];
      const answer = Number(rec.answer);
      const explain = String(rec.explain ?? rec.explanation ?? "").replace(/\s+/g, " ").trim().slice(0, 300)
        || `Tests practical ${skill} knowledge.`;
      if (question.length < 12) continue;
      if (opts.length !== 4 || opts.some((o) => o.length < 1)) continue;
      if (!Number.isInteger(answer) || answer < 0 || answer > 3) continue;
      if (new Set(opts.map((o) => o.toLowerCase())).size !== 4) continue;
      const key = question.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ skill, question, options: opts, answer, explain });
    }
    return out;
  } catch {
    return [];
  }
}

async function genQuizForSkill(skill: string, want: number): Promise<Omit<QuizQ, "id">[]> {
  const seed = Math.random().toString(36).slice(2, 8);
  const text = await genText(
    `${GUARD}\nYou are a technical interviewer for Indian college students. Write ${want} DISTINCT beginner-to-intermediate multiple-choice questions testing practical ${skill} knowledge for internships.\nRules:\n- Every question strictly about ${skill}, nothing else.\n- All ${want} questions mutually distinct — different subtopics/angles, never paraphrase repeats.\n- 4 options each, exactly one correct, plausible distractors, VARY the correct position across questions (not always A).\n- Keep question <= 28 words, each option <= 12 words, explain <= 22 words (why the answer is right).\n- Variation seed ${seed} — pick different angles than the obvious textbook set.\nReturn ONLY JSON: {"questions":[{"question":string,"options":[string,string,string,string],"answer":0,"explain":string}]}`,
    true,
    { temperature: 0.9, maxOutputTokens: 3000 }
  );
  return sanitizeQuizItems(text, skill);
}

/** Dynamic per-skill quiz: `perSkill` FRESH questions for EVERY topic. Gemini first, local bank fills any shortfall. */
export async function aiQuiz(skills: string[], perSkill = 6) {
  const norm = [...new Set(
    (skills.length ? skills : ["javascript", "react", "sql"]).map((s) => s.trim().toLowerCase()).filter(Boolean)
  )].slice(0, 8);
  const pool = norm.length ? norm : ["javascript", "react", "sql"];
  const want = Math.min(10, Math.max(3, Math.floor(perSkill) || 6));
  const fallback = () => ({ questions: buildQuiz(pool, want), dynamic: false as const });

  if (!hasKey()) return fallback();
  try {
    const settled = await Promise.allSettled(pool.map((s) => genQuizForSkill(s, want)));
    const perSkillLists = new Map<string, Omit<QuizQ, "id">[]>();
    const seenGlobal = new Set<string>();
    pool.forEach((skill, i) => {
      const got = settled[i].status === "fulfilled"
        ? (settled[i] as PromiseFulfilledResult<Omit<QuizQ, "id">[]>).value
        : [];
      const kept: Omit<QuizQ, "id">[] = [];
      for (const q of got) {
        const key = q.question.trim().toLowerCase();
        if (seenGlobal.has(key)) continue;
        seenGlobal.add(key);
        kept.push(q);
        if (kept.length >= want) break;
      }
      perSkillLists.set(skill, kept);
    });

    // Fill any shortfall per skill from the local bank (never repeating seen text).
    for (const skill of pool) {
      const have = perSkillLists.get(skill) ?? [];
      if (have.length >= want) continue;
      const local = buildQuiz([skill], want);
      for (const q of local) {
        const key = q.question.trim().toLowerCase();
        if (seenGlobal.has(key)) continue;
        seenGlobal.add(key);
        have.push({ skill, question: q.question, options: q.options, answer: q.answer, explain: q.explain });
        if (have.length >= want) break;
      }
      perSkillLists.set(skill, have);
    }

    // Interleave round-robin so adjacent questions are different skills.
    const order = [...pool].sort(() => Math.random() - 0.5);
    const out: QuizQ[] = [];
    for (let round = 0; round < want; round++) {
      for (const skill of order) {
        const item = perSkillLists.get(skill)?.[round];
        if (item) out.push({ ...item, id: `q${out.length}` });
      }
    }
    if (!out.length) return fallback();
    return { questions: out, dynamic: true as const };
  } catch {
    return fallback();
  }
}

export async function aiImprove(profile: ParsedProfile) {
  const suggestions = improveResume(profile);
  if (!hasKey()) return { suggestions };
  try {
    const text = await genText(`${GUARD}\nRewrite these 2 resume bullets to be stronger WITHOUT inventing experience. Profile skills: ${profile.skills.join(", ")}.\nBullets: ${JSON.stringify(profile.projects.slice(0, 2))}`, false);
    return { suggestions, aiRewrite: text.slice(0, 800) };
  } catch {
    return { suggestions };
  }
}

/** AI-personalized entry-level role fits. Deterministic fallback always works (demo mode). */
export async function aiRoles(profile: ParsedProfile) {
  const fallback = recommendRoles(profile);
  if (!hasKey()) return { roles: fallback, aiPersonalized: false as const };
  try {
    const text = await genText(
      `${GUARD}\nYou are a career instrument for Indian college students. Given this parsed resume profile, recommend 3-4 entry-level roles (internships only) that fit NOW. Ground every why/lift ONLY in the listed skills, experience and projects — never invent qualifications. Present fits as decision-support, never hiring verdicts.\nReturn ONLY JSON: {"roles":[{"role":string,"why":string,"lift":string}]} where why names the detected proof (max 24 words) and lift names ONE next skill plus its payoff (max 20 words).\n\nProfile:\n${JSON.stringify({ skills: profile.skills, skillLevels: profile.skillLevels, experience: profile.experience.slice(0, 4), projects: profile.projects.slice(0, 4), education: profile.education.slice(0, 2) })}`,
      true
    );
    const j = JSON.parse(text) as { roles?: unknown } | unknown[];
    const arr = Array.isArray(j) ? j : Array.isArray((j as { roles?: unknown }).roles) ? (j as { roles: unknown[] }).roles : [];
    const roles = arr
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => ({
        role: String(r.role ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
        why: String(r.why ?? "").replace(/\s+/g, " ").trim().slice(0, 220),
        lift: String(r.lift ?? "").replace(/\s+/g, " ").trim().slice(0, 220),
      }))
      .filter((r) => r.role.length >= 3 && r.why.length >= 8);
    if (roles.length < 2) return { roles: fallback, aiPersonalized: false as const };
    return { roles: roles.slice(0, 4), aiPersonalized: true as const };
  } catch {
    return { roles: fallback, aiPersonalized: false as const };
  }
}

export async function aiChat(profile: ParsedProfile | null, history: { role: string; text: string }[], message: string) {
  if (!hasKey()) {
    // Grounded rule-based fallback
    const skills = profile?.skills.join(", ") || "no parsed skills yet";
    const t = message.toLowerCase();
    if (t.includes("gap") || t.includes("learn")) return { reply: `Based on your parsed profile (${skills}), fix this order: 1) top missing JD skill, 2) one deploy skill (Docker/AWS), 3) one proof skill (testing). Open Roadmap for the step plan. (Demo reply — add GEMINI_API_KEY for full AI.)` };
    if (t.includes("job") || t.includes("role")) { const recs = profile ? recommendRoles(profile).map((r) => r.role).join(", ") : "Upload a resume first"; return { reply: `Roles that fit your current skills: ${recs}. Paste a JD on the Jobs page for an exact score. (Demo reply.)` }; }
    return { reply: `I can see your profile: ${profile?.name ?? "no resume yet"} — ${skills}. Ask me about gaps, roles, roadmap order, or projects. (Demo reply — add GEMINI_API_KEY for full AI.)` };
  }
  try {
    const ctx = `Profile: ${JSON.stringify(profile ?? {})}. ${GUARD} Answer as a concise career coach (max 150 words). Use short paragraphs and markdown lists where they help.`;
    const convo = history.map((h) => `${h.role}: ${h.text}`).join("\n");
    const text = await genText(`${ctx}\n${convo}\nuser: ${message}`, false);
    return { reply: text.slice(0, 1200) };
  } catch {
    return { reply: "AI unreachable — try again (demo fallback active)." };
  }
}
