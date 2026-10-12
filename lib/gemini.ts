import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildQuiz, buildRoadmap, improveResume, matchJob,
  parseResumeText, recommendRoles, scoreHealth,
} from "./analysis";
import { normalizeSkill } from "./skills";
import type { ParsedProfile } from "./types";

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
async function genText(prompt: string, jsonMode: boolean): Promise<string> {
  const tried: string[] = [];
  for (const name of [MODEL, ...FALLBACKS.filter((f) => f !== MODEL)]) {
    try {
      const m = model(name);
      const r = await m.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: jsonMode
          ? { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 2048 }
          : { temperature: 0.4, maxOutputTokens: 1200 },
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
      links: strArray(j.links, 5, 80),
      education: strArray(j.education, 5, 160),
      experience: strArray(j.experience, 6, 180),
      projects: strArray(j.projects, 6, 180),
      certifications: strArray(j.certifications, 5, 140),
      skills: strArray(j.skills, 20, 30).map(normalizeSkill),
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
  return {
    ...base,
    name: (llm.name as string) && (llm.name as string).trim().length >= 2 ? (llm.name as string).trim() : base.name,
    email: (llm.email as string) || base.email,
    phone: (llm.phone as string) || base.phone || "",
    links: [...new Set([...(llm.links as string[] ?? []), ...(base.links ?? [])])].slice(0, 5),
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

export async function aiQuiz(skills: string[], count = 6) {
  return { questions: buildQuiz(skills, count) };
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
