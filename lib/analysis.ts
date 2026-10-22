import {
  HealthResult,
  ImproveSuggestion,
  JobMatch,
  ParsedProfile,
  QuizQ,
  RoadmapStep,
  SkillGap,
} from "./types";
import { countMentions, extractJDKeywords, extractSkillsFromText, normalizeSkill } from "./skills";

/** Bump when parser caps/shape change so hash-deduped caches never serve stale rows. */
export const PARSER_VERSION = 3;

const WHY: Record<string, string> = {
  javascript: "Core language for web roles — JDs screen for it first.",
  typescript: "Type-safety signal for production frontend teams.",
  react: "Most intern JDs list React/Next.js as day-one stack.",
  python: "Backend + scripting + ML baseline for many roles.",
  java: "Enterprise backend interviews assume Java + OOP depth.",
  sql: "Every data/backend role tests querying real tables.",
  git: "Teams expect clean branching and PR hygiene.",
  docker: "Ships identically everywhere — the classic 78→84 booster.",
  aws: "Deploy + host: turns a project into a live link.",
  "machine learning": "Separates applied-AI roles from generic coders.",
  "data analysis": "Lets you prove impact with numbers, not adjectives.",
  communication: "Interview + teamwork signal; weak resumes hide it.",
  dsa: "Shortlisting filter for SDE interviews.",
  testing: "Production readiness — untested projects read as toys.",
  "system design": "Converts a coder into an engineer in senior eyes.",
  html: "Frontend completeness — styling + responsive proof.",
};

function whyFor(skill: string): string {
  return WHY[skill] ?? `Listed across entry-level JDs for this track — proof beats claims.`;
}

const SECTION_KEYS: Record<string, string[]> = {
  education: ["education", "academic background", "academic qualification", "qualification"],
  experience: ["experience", "experiences", "employment", "work history", "work experience", "internship", "internships"],
  projects: ["project", "projects", "personal project", "personal projects", "key project", "key projects"],
  skills: ["skill", "skills", "technical skill", "technical skills", "key skills", "tech stack", "core competencies", "competencies", "technologies"],
  certifications: ["certificat", "certificats", "certifications", "certificate", "certificates", "course", "courses", "training", "license", "achievement", "achievements"],
  summary: ["summary", "objective", "profile", "about me", "career objective"],
};

function isSectionHeader(line: string): string | null {
  const norm = line.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!norm || norm.length > 45) return null;
  for (const [section, keys] of Object.entries(SECTION_KEYS)) {
    for (const k of keys) {
      if (norm === k || norm === `${k}s` || norm.startsWith(`${k} `) || norm.endsWith(` ${k}`) || norm.endsWith(` ${k}s`)) return section;
    }
  }
  return null;
}

function splitSections(lines: string[]): { sections: Partial<Record<string, string[]>>; header: string[] } {
  const sections: Partial<Record<string, string[]>> = {};
  const header: string[] = [];
  let current: string | null = null;
  let seenHeader = false;
  for (const line of lines) {
    const sec = isSectionHeader(line);
    if (sec) {
      current = sec;
      seenHeader = true;
      if (!sections[current]) sections[current] = [];
      continue;
    }
    if (!seenHeader) {
      if (header.length < 10) header.push(line);
      continue;
    }
    if (current) sections[current]!.push(line);
  }
  return { sections, header };
}

/** Strip header junk (emails, phones, links, separators) so a name is just a name. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " ")
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, " ")
    .replace(/(linkedin\.com\S*|github\.com\S*|[\w-]+\.(dev|io|app|me)\S*)/gi, " ")
    .replace(/\blinkedin\b|\bgithub\b/gi, " ")
    .replace(/[#|•·▪|]/g, " ")
    .replace(/\b(resume|curriculum|vitae|biodata)\b/gi, " ")
    .replace(/(^|\s)[^\w\s](\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function detectName(lines: string[], header: string[]): string {  const bad = /resume|curriculum|vitae|biodata|phone|mobile|email|address|linkedin|github|objective/i;
  for (const line of [...header, ...lines.slice(0, 8)]) {
    const clean = line.replace(/[|•·▪-]/g, " ").replace(/\s+/g, " ").trim();
    const words = clean.split(" ").filter(Boolean);
    const digitCount = (clean.match(/\d/g) || []).length;
    if (
      words.length >= 2 && words.length <= 4 && clean.length <= 45 &&
      digitCount <= 2 && !clean.includes("@") && !bad.test(clean) &&
      words.every((w) => /^[A-Z][a-z'’.-]*$/.test(w) || /^[A-Z]\.$/.test(w))
    ) return clean.slice(0, 60);
  }
  return (lines[0] ?? "Candidate").slice(0, 60) || "Candidate";
}

function detectContacts(text: string): { email: string; phone: string; links: string[] } {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? "";
  const phones = [...text.matchAll(/(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){9,13}\d/g)].map((m) => m[0].trim());
  const phone = phones.find((p) => (p.replace(/\D/g, "").length >= 10 && p.replace(/\D/g, "").length <= 14)) ?? "";
  const linkSet = new Set<string>();
  const linkRe = /(github\.com\/[\w.-]+|linkedin\.com\/in\/[\w.-]+|[\w-]+\.(dev|io|app|me)(?:\/[\w./-]*)?|[\w-]+\.vercel\.app|[\w-]+\.netlify\.app|[\w-]+\.github\.io)/gi;
  for (const m of text.matchAll(linkRe)) linkSet.add(m[0].toLowerCase().replace(/\/$/, ""));
  return { email, phone, links: [...linkSet].slice(0, 8) };
}

const BULLET_LEAD = /^[•·▪‣○◦▸►»\-–—*]\s+/;
const DATE_RANGE = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[-–—]|20\d{2}\s*[-–—]\s*(?:20\d{2}|present|current|now)/i;
const LINK_LINE = /^(https?:\/\/|[\w-]+\.[a-z]{2,}\/)/i;

function entriesFromSection(lines: string[], max: number, maxLen: number): string[] {
  if (!lines.length) return [];
  // Line-based grouping: bullets and link-only lines always continue the
  // current entry; date ranges open a new entry WITH their title line intact
  // (never split "Role, Jun 2024 – Aug 2024" away from its dates).
  const entries: string[] = [];
  let cur = "";
  const push = () => {
    const c = cur.replace(/\s+/g, " ").trim();
    if (c.length > 8) entries.push(c.slice(0, maxLen));
    cur = "";
  };
  for (const raw of lines) {
    const line = raw.replace(BULLET_LEAD, "").trim();
    if (!line) continue;
    if (!cur) { cur = line; continue; }
    if (DATE_RANGE.test(line)) { push(); cur = line; continue; }
    if (LINK_LINE.test(line) && line.length < 90) { cur += " " + line; continue; }
    if (BULLET_LEAD.test(raw)) { cur += " " + line; continue; }
    // Short titled line after a dated entry starts a new one.
    if (line.length < 80 && /[,|]/.test(line) && /^[A-Z]/.test(line) && DATE_RANGE.test(cur)) { push(); cur = line; continue; }
    cur += " " + line;
  }
  push();
  return [...new Map(entries.map((c) => [c.toLowerCase(), c])).values()].slice(0, max);
}

function skillsFromSection(lines: string[]): string[] {
  if (!lines.length) return [];
  return lines
    .join(",")
    .split(/[,|/•·▪;·\n]|(?<=\s)-(?=\s)/)
    .map((t) => normalizeSkill(t))
    .filter((t) => t.length >= 2 && t.length <= 30 && !/^(and|with|using|including|etc|more)$/.test(t));
}

export function parseResumeText(text: string): ParsedProfile {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const { sections, header } = splitSections(lines);
  const { email, phone, links } = detectContacts(text);
  const name = cleanName(detectName(lines, header)) || "Candidate";

  // Explicit skills section (authoritative) ∪ whole-document detection (safety net).
  const listed = skillsFromSection(sections.skills ?? []);
  const detected = extractSkillsFromText(text);
  let skills = [...new Set([...listed, ...detected])];

  // World-class rule: 1–2 letter tokens (js/ts/ml/go) are only trusted from an
  // explicit skills section or 2+ mentions — kills verb phantoms ("eager to go").
  const listedSet = new Set(listed);
  skills = skills.filter((s) => s.length > 2 || listedSet.has(s) || countMentions(text, s) >= 2);

  const education = entriesFromSection(sections.education ?? [], 8, 500);
  let experience = entriesFromSection(sections.experience ?? [], 10, 2000);
  let projects = entriesFromSection(sections.projects ?? [], 10, 2000);
  const certifications = entriesFromSection(sections.certifications ?? [], 8, 500);

  // Fallback for header-less pastes: keyword capture so fragments still analyze.
  if (Object.keys(sections).length === 0) {
    const scan = (keys: string[]) => {
      const out: string[] = [];
      for (const l of lines) {
        if (keys.some((k) => l.toLowerCase().includes(k))) {
          const c = l.replace(/\s+/g, " ").trim();
          if (c.length > 10) out.push(c.slice(0, 1500));
          if (out.length >= 8) break;
        }
      }
      return out;
    };
    if (!experience.length) experience = scan(["intern", "worked", "employed", "role", "developer", "engineer"]);
    if (!projects.length) projects = scan(["built", "developed", "created", "project", "app", "website"]);
  }

  const skillLevels: ParsedProfile["skillLevels"] = {};
  for (const s of skills) {
    const n = countMentions(text, s);
    skillLevels[s] = n >= 4 ? "advanced" : n >= 2 ? "intermediate" : "beginner";
  }

  return {
    name, email, phone, links,
    education: education.length ? education : ["Add your degree, college, year, CGPA"],
    skills, skillLevels,
    experience, projects, certifications,
    rawLength: text.length,
  };
}

const DEGREE = /\b(b\.?\s?tech|b\.?\s?e\.?|b\.?\s?sc|b\.?\s?ca|b\.?\s?com|m\.?\s?tech|m\.?\s?sc|m\.?\s?ca|mba|bachelor|master|diploma|ph\.?d|b\.?\s?s\.?|m\.?\s?s\.?)\b/i;
const EDU_WORD = /\b(university|college|institute|school of|cgpa|gpa|percentage)\b/i;
const NON_RESUME = /\b(abstract|invoice|bill to|total due|amount due|terms and conditions|table of contents|lorem ipsum|chapter \d|et al\.|doi:|purchase order|statement of account)\b/gi;
const ACTION_VERBS = /\b(built|developed|designed|implemented|created|led|launched|deployed|optimi[sz]ed|reduced|improved|increased|automated|integrated|architected|migrated|engineered|delivered|managed|analy[sz]ed|trained|shipped|refactored)\b/gi;
const METRIC = /\b\d+(?:\.\d+)?\s?(?:%|x\b|k\+?|m\+?|ms\b|users?|customers?|requests?|downloads?|stars?|students?|hrs?|hours?|records?|endpoints?|apis?)|[$₹€£]\s?\d|\b\d{2,}\+/gi;

export interface ResumeGate { ok: boolean; score: number; reasons: string[] }

/**
 * Weighted resume-likelihood (0–100). Independent signals, so one stray keyword
 * ("project", "experience") can never pass a random PDF; non-resume markers subtract.
 * Pass needs >= 40 AND at least one core section or (contact + skills).
 */
export function resumeGate(text: string): ResumeGate {
  const reasons: string[] = [];
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 40) return { ok: false, score: 0, reasons: ["too little text"] };

  const { email, phone, links } = detectContacts(text);
  const secs = new Set(lines.map(isSectionHeader).filter((s): s is string => !!s));
  const core = ["education", "experience", "projects", "skills"].filter((s) => secs.has(s)).length;
  const skills = extractSkillsFromText(text).length;
  const dates = lines.filter((l) => DATE_RANGE.test(l)).length;
  const verbs = new Set((text.match(ACTION_VERBS) ?? []).map((v) => v.toLowerCase())).size;
  const bullets = lines.filter((l) => BULLET_LEAD.test(l)).length;
  const hasEdu = DEGREE.test(text) && EDU_WORD.test(text);
  const junk = (text.match(NON_RESUME) ?? []).length;

  let s = 0;
  if (email) s += 12;
  if (phone) s += 8;
  if (links.some((l) => /github|linkedin/.test(l))) s += 6;
  s += Math.min(core, 3) * 8 + (secs.size > core ? 3 : 0);
  s += skills >= 6 ? 14 : skills >= 3 ? 8 : skills >= 1 ? 2 : 0;
  if (hasEdu) s += 10;
  if (dates) s += Math.min(dates, 2) * 4;
  if (verbs >= 3) s += 6;
  if (bullets >= 3) s += 4;
  s -= junk * 12;
  if (words > 2500) s -= 15; // papers/reports, not resumes
  s = Math.max(0, Math.min(100, s));

  if (!email && !phone) reasons.push("no email or phone");
  if (!core) reasons.push("no Education/Experience/Projects/Skills section");
  if (skills < 3) reasons.push("fewer than 3 recognisable skills");
  if (junk) reasons.push("looks like another document type");
  const ok = s >= 40 && (core >= 1 || (!!(email || phone) && skills >= 3));
  return { ok, score: s, reasons };
}

export function looksLikeResume(text: string): boolean {
  return resumeGate(text).ok;
}

/**
 * Rubric score, 100 pts, earned from zero (no free base). Rewards evidence,
 * not keywords: real metrics, dated experience, degree+year, scoped projects.
 */
export function scoreHealth(profile: ParsedProfile, rawText: string): HealthResult {
  const issues: HealthResult["issues"] = [];
  const strengths: string[] = [];
  let score = 0;
  const words = rawText.split(/\s+/).filter(Boolean).length;
  const lines = rawText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const issue = (section: string, severity: "critical" | "warn" | "good", message: string, fix: string) => issues.push({ section, severity, message, fix });

  // Contact (8)
  const { email, phone, links } = detectContacts(rawText);
  if (email) score += 4; else issue("Contact", "critical", "No email found", "Add a professional email in the header.");
  if (phone) score += 2; else issue("Contact", "warn", "No phone number", "Add a reachable phone number.");
  if (links.some((l) => /github|linkedin/.test(l)) || /linkedin|github|portfolio/i.test(rawText)) { score += 2; strengths.push("Profile links present"); }
  else issue("Links", "warn", "No GitHub/LinkedIn/portfolio links", "Add live links — recruiters click them.");

  // Skills (16)
  const nSkills = profile.skills.length;
  score += Math.min(16, Math.round(nSkills * 1.6));
  if (nSkills >= 8) strengths.push(`${nSkills} detectable skills`);
  else issue("Skills", nSkills < 3 ? "critical" : "warn", `Only ${nSkills} skills detected`, "Add a Skills section with 8–12 job-relevant keywords.");

  // Projects (18): substance counts, one-liners don't
  const solid = profile.projects.filter((p) => p.length >= 60).length;
  score += Math.min(18, solid * 6 + Math.max(0, profile.projects.length - solid) * 1);
  if (solid >= 2) strengths.push(`${solid} detailed projects show build ability`);
  else issue("Projects", "warn", solid ? "Only 1 project with real detail" : "No detailed projects", "Add 2 projects with stack + outcome (e.g. cut load time 40%).");

  // Experience (14)
  const exp = profile.experience.length;
  const datedExp = profile.experience.filter((e) => DATE_RANGE.test(e)).length;
  if (exp) { score += 8 + (exp >= 2 || datedExp ? 6 : 0); strengths.push("Experience present"); }
  else issue("Experience", "warn", "No internship/experience entries", "Add internship, freelance, or club work — even 1 entry helps.");
  if (exp && !datedExp) issue("Experience", "warn", "Experience has no dates", "Add 'Mon YYYY – Mon YYYY' to each role.");

  // Education (10)
  const edu = profile.education.join(" ");
  const eduReal = profile.education.length > 0 && !profile.education[0].startsWith("Add");
  if (eduReal) {
    if (DEGREE.test(edu) || EDU_WORD.test(edu)) score += 5;
    if (/(19|20)\d{2}/.test(edu) || /cgpa|gpa|\d\.\d|\d+\s?%/i.test(edu)) score += 5;
  }
  if (score === 0 || !eduReal || !(/(19|20)\d{2}/.test(edu))) issue("Education", "warn", "Education incomplete", "Degree + college + year + CGPA on one line.");

  // Impact (14): real metrics only; "built"/"improved" alone earn nothing here
  const metrics = (rawText.match(METRIC) ?? []).length;
  score += metrics >= 3 ? 14 : metrics === 2 ? 9 : metrics === 1 ? 5 : 0;
  if (metrics >= 3) strengths.push("Quantified impact found");
  else issue("Impact", "warn", metrics ? "Few measurable results" : "No numbers or outcomes", "Add 3 metrics: users, speed, accuracy, downloads.");

  // Action verbs (6)
  const verbs = new Set((rawText.match(ACTION_VERBS) ?? []).map((v) => v.toLowerCase())).size;
  if (verbs >= 4) { score += 6; strengths.push("Strong action verbs"); }
  else { score += verbs; issue("Wording", "warn", "Weak or repeated verbs", "Start bullets with built/led/reduced/shipped."); }

  // Certifications (4), structure (4)
  if (profile.certifications.length) { score += 4; strengths.push("Certifications verify learning"); }
  const secs = new Set(lines.map(isSectionHeader).filter(Boolean)).size;
  if (secs >= 4) score += 4; else if (secs >= 2) score += 2;
  else issue("Structure", "warn", "Few clear section headings", "Use standard headings: Education, Skills, Projects, Experience.");

  // Length (6)
  if (words >= 250 && words <= 900) score += 6;
  else if (words >= 150 && words <= 1200) score += 3;
  if (words < 250) issue("Depth", words < 150 ? "critical" : "warn", `Resume very short (${words} words)`, "Aim for 1 full page — add projects + skills.");
  if (words > 1200) issue("Length", "warn", "Overlong — recruiters skim", "Cut to 1 page, keep newest 3 items.");

  return { score: Math.max(8, Math.min(96, Math.round(score))), issues, strengths };
}

export function matchJob(profile: ParsedProfile, jd: string, title = "Target role", company = "Company"): JobMatch {
  const jdSkills = extractJDKeywords(jd);
  const have = new Set(profile.skills.map(normalizeSkill));
  const matched: string[] = [], partial: string[] = [], missing: string[] = [];

  for (const s of jdSkills) {
    if (have.has(s)) matched.push(s);
    else if ([...have].some((h) => s.includes(h) || h.includes(s))) partial.push(s);
    else missing.push(s);
  }
  // If JD has no detectable skills, fall back to generic overlap
  const denom = Math.max(jdSkills.length, 1);
  const score = Math.round(((matched.length + partial.length * 0.5) / denom) * 100);
  const matchScore = jdSkills.length === 0 ? 45 : Math.max(12, Math.min(97, score));

  const gaps: SkillGap[] = [
    ...missing.map((s): SkillGap => ({ skill: s, status: "missing", priority: "high", whyItMatters: whyFor(s) })),
    ...partial.map((s): SkillGap => ({ skill: s, status: "partial", priority: "medium", whyItMatters: whyFor(s) + " You have adjacent proof — deepen it." })),
    ...matched.slice(0, 4).map((s): SkillGap => ({ skill: s, status: "have", priority: "low", whyItMatters: "Verified in your resume — keep sharp." })),
  ];

  const verdict = matchScore >= 75 ? "Strong fit — apply now, fix top gap in parallel."
    : matchScore >= 55 ? "Competitive — 1–2 targeted skills unlock this role."
    : "Stretch — build the 2 high-priority gaps first, then apply.";

  return { id: Math.random().toString(36).slice(2, 8), title, company, matchScore, matched, partial, missing, gaps, verdict };
}

export function buildRoadmap(gaps: SkillGap[], have: string[]): RoadmapStep[] {
  const todo = gaps.filter((g) => g.status !== "have").slice(0, 4);
  const steps: RoadmapStep[] = todo.map((g, i) => ({
    order: i + 1,
    title: `Master ${g.skill}`,
    skills: [g.skill],
    weeks: i === 0 ? "Week 1–2" : i === 1 ? "Week 3–4" : `Week ${3 + i * 2}–${4 + i * 2}`,
    actions: [
      `Core concepts of ${g.skill} (2 hrs/day, docs + one guided tutorial)`,
      `Guided build: mini-project using ${g.skill}${have.length ? ` + ${have[0]}` : ""}`,
      "Push to GitHub with README + demo link",
    ],
    project: `Ship a ${g.skill} micro-project and link it on your resume`,
    outcome: `Can demo ${g.skill} in interviews without bluffing`,
  }));
  steps.push({
    order: steps.length + 1,
    title: "Prove it on your resume",
    skills: [],
    actions: ["Rewrite 3 bullets with metrics", "Re-run Job Match to confirm lift", "Take the verification quiz"],
    weeks: "Final week",
    project: "Updated resume + live demo links",
    outcome: "Resume claims match verified knowledge",
  });
  return steps;
}

export function improveResume(profile: ParsedProfile): ImproveSuggestion[] {
  const out: ImproveSuggestion[] = [];
  if (!profile.projects.length) out.push({ section: "Projects", before: "No projects listed", after: "Built X with [stack] — serves N users, loads in Ys (link: github/demo)", reason: "Projects are the #1 proof for freshers." });
  else out.push({ section: "Projects", before: profile.projects[0], after: `${profile.projects[0]} — add stack + metric + link`, reason: "Recruiters scan for stack, scale, outcome." });
  out.push({ section: "Experience", before: "Helped with tasks", after: "Shipped [feature] using [skill], cutting [metric] by [N%] across [scope]", reason: "Strong verbs + numbers beat duties." });
  out.push({ section: "Skills", before: profile.skills.join(", ") || "No skills section", after: `Group skills: Languages / Frameworks / Tools / CS fundamentals (${profile.skills.slice(0, 10).join(", ")})`, reason: "Grouped keywords pass ATS + human skim." });
  return out;
}

type QuizBankItem = { q: string; opts: string[]; a: number; e: string };

const QUIZ_BANK: Record<string, QuizBankItem[]> = {
  javascript: [
    { q: "What does `===` check that `==` does not?", opts: ["Value only", "Value + type without coercion", "Reference only", "Nothing"], a: 1, e: "`===` skips type coercion — fewer bugs." },
    { q: "Why prefer `const`/`let` over `var`?", opts: ["They are faster to type", "Block scope + no hoisting surprises", "They work without declaring", "They allow redeclaration everywhere"], a: 1, e: "`let`/`const` are block-scoped; `var` hoists and leaks." },
    { q: "What does `Array.map()` return?", opts: ["A new array with transformed items", "Nothing — it mutates in place", "The first matching item", "A boolean"], a: 0, e: "`map` builds a new array; use it for transforms." },
  ],
  typescript: [
    { q: "What does `unknown` give you over `any`?", opts: ["Nothing — they are identical", "Type-safety: you must narrow before use", "Faster compilation", "Automatic runtime checks"], a: 1, e: "`unknown` forces narrowing; `any` disables checking." },
    { q: "What is an interface for?", opts: ["Styling components", "Describing the shape of an object type", "Running code faster", "Deploying apps"], a: 1, e: "Interfaces declare object shapes the compiler enforces." },
    { q: "What breaks under `strict` null checks?", opts: ["Assigning `null` where a value is required", "Using functions", "Importing modules", "Adding comments"], a: 0, e: "Strict mode surfaces null/undefined bugs at compile time." },
  ],
  react: [
    { q: "Where should data-fetching side effects live?", opts: ["In render body", "In useEffect / event handlers", "In JSX props", "In CSS"], a: 1, e: "Effects belong in useEffect/handlers, not render." },
    { q: "Why do list items need a stable `key`?", opts: ["For styling", "So React can reconcile the right rows on updates", "To make them clickable", "Keys are optional metadata"], a: 1, e: "Keys let React match rows across renders." },
    { q: "What is the rule for hooks?", opts: ["Call them inside loops only", "Call at top level, never conditionally", "Call them in event handlers only", "No rules"], a: 1, e: "Hooks must run in the same order every render." },
  ],
  "node.js": [
    { q: "Why is Node.js good for I/O-heavy APIs?", opts: ["It blocks on every request", "Non-blocking event loop handles concurrent I/O", "It runs only one request per day", "It needs no JavaScript"], a: 1, e: "The event loop overlaps I/O instead of blocking threads." },
    { q: "What is Express middleware?", opts: ["A CSS framework", "A function that processes req/res in a chain", "A database", "A test runner"], a: 1, e: "Middleware runs in order: auth, parse, handle, respond." },
    { q: "How should you read a file without blocking?", opts: ["`fs.readFileSync` everywhere", "`fs.promises.readFile` / async APIs", "Copy-paste the file", "Restart the server"], a: 1, e: "Async fs APIs keep the loop free for other requests." },
  ],
  python: [
    { q: "What is a list comprehension?", opts: ["A loop that builds a list inline", "A dict type", "A test runner", "A server"], a: 0, e: "`[x for x in ...]` builds lists concisely." },
    { q: "What does a virtualenv solve?", opts: ["Slow internet", "Isolated dependency versions per project", "Bad syntax", "Missing RAM"], a: 1, e: "One project should never break another's packages." },
    { q: "What is `None`?", opts: ["The absence of a value", "Zero", "An empty string", "An error code"], a: 0, e: "`None` means no value — check with `is None`." },
  ],
  java: [
    { q: "What does the JVM do?", opts: ["Edits images", "Runs bytecode portably across platforms", "Designs UIs", "Sends emails"], a: 1, e: "Compile once, run on any JVM." },
    { q: "`static` vs instance method?", opts: ["No difference", "`static` belongs to the class, instance belongs to an object", "`static` is slower", "Instance methods can't use objects"], a: 1, e: "`static` needs no object; instance methods do." },
    { q: "How should checked exceptions be handled?", opts: ["Ignore them silently", "Catch or declare with try/catch or `throws`", "Delete the code", "Restart the IDE"], a: 1, e: "Java forces you to plan for failure paths." },
  ],
  "c++": [
    { q: "What is a pointer?", opts: ["A variable holding a memory address", "A UI element", "A loop type", "A compiler flag"], a: 0, e: "Pointers reference memory directly — handle with care." },
    { q: "Why prefer `std::vector` over raw arrays?", opts: ["It is older", "Dynamic size + bounds-checked access", "It uses less memory always", "It skips compilation"], a: 1, e: "`vector` grows safely; raw arrays don't." },
    { q: "What is a reference (`int&`)?", opts: ["An alias to an existing variable", "A copy of data", "A file path", "A comment"], a: 0, e: "References alias without copying or null." },
  ],
  go: [
    { q: "What is a goroutine?", opts: ["A lightweight concurrent function", "A database table", "A CSS class", "A test file"], a: 0, e: "`go f()` runs concurrently with tiny overhead." },
    { q: "How do goroutines usually communicate?", opts: ["Global variables only", "Channels", "Email", "Screenshots"], a: 1, e: "`chan` passes data safely between goroutines." },
    { q: "What does `defer` do?", opts: ["Deletes code", "Schedules a call to run when the function returns", "Speeds up loops", "Imports packages"], a: 1, e: "`defer` is ideal for cleanup like closing files." },
  ],
  rust: [
    { q: "What is ownership in Rust?", opts: ["Each value has one owner; dropping frees it", "Anyone can free anything", "Memory never frees", "Variables can't be used"], a: 0, e: "Ownership + borrowing prevent use-after-free at compile time." },
    { q: "What does `Result<T, E>` express?", opts: ["A number range", "Success (`Ok`) or failure (`Err`) explicitly", "A loop", "A string"], a: 1, e: "Rust makes errors values you must handle." },
    { q: "What does `mut` allow?", opts: ["Deleting files", "Mutating a binding", "Faster Wi-Fi", "Skipping tests"], a: 1, e: "Bindings are immutable unless marked `mut`." },
  ],
  sql: [
    { q: "What does JOIN do?", opts: ["Deletes rows", "Combines rows across tables on a key", "Sorts files", "Encrypts data"], a: 1, e: "JOINs relate tables via keys." },
    { q: "WHERE vs HAVING?", opts: ["They are identical", "WHERE filters rows, HAVING filters groups after GROUP BY", "HAVING sorts output", "WHERE deletes tables"], a: 1, e: "Filter rows with WHERE, grouped results with HAVING." },
    { q: "What does a PRIMARY KEY guarantee?", opts: ["Nullable duplicates", "Unique, non-null row identity", "Faster typing", "Auto-deletion"], a: 1, e: "Primary keys uniquely identify every row." },
  ],
  git: [
    { q: "What does `git rebase` do?", opts: ["Deletes repo", "Replays commits onto a new base", "Pushes to cloud", "Merges PDFs"], a: 1, e: "Rebase rewrites history onto a new base — keep it clean on shared branches." },
    { q: "You have a merge conflict — what happened?", opts: ["Two branches changed the same lines", "The repo was deleted", "Wi-Fi dropped", "GitHub is down"], a: 0, e: "Resolve the marked hunks, then commit." },
    { q: "What does `git pull` do?", opts: ["Deletes local work", "Fetches + merges remote changes", "Creates a repo", "Formats code"], a: 1, e: "`pull` = `fetch` + `merge` for the current branch." },
  ],
  docker: [
    { q: "What is a Docker image?", opts: ["A running process", "An immutable template containers start from", "A VM", "A log file"], a: 1, e: "Images are templates; containers are running instances." },
    { q: "What does a Dockerfile describe?", opts: ["Meeting notes", "Reproducible steps to build an image", "A resume", "A database schema"], a: 1, e: "Dockerfiles make builds repeatable anywhere." },
    { q: "Why map ports (`-p 3000:3000`)?", opts: ["To delete containers", "To expose container ports on the host", "To speed up builds", "To encrypt code"], a: 1, e: "Without mapping, the app stays unreachable outside." },
  ],
  aws: [
    { q: "EC2 vs S3?", opts: ["Both are databases", "EC2 is compute, S3 is object storage", "Both are DNS", "S3 runs servers"], a: 1, e: "Run code on EC2, store files/blobs on S3." },
    { q: "What does IAM control?", opts: ["Image editing", "Who can do what on which resources", "Internet speed", "Code formatting"], a: 1, e: "Least-privilege IAM roles limit blast radius." },
    { q: "Why deploy in the nearest region?", opts: ["Lower latency + data residency", "It looks nicer", "Regions don't matter", "To use more servers"], a: 0, e: "Proximity cuts latency; regions affect compliance." },
  ],
  linux: [
    { q: "What does `chmod +x` do?", opts: ["Deletes a file", "Makes a file executable", "Compresses folders", "Prints logs"], a: 1, e: "Scripts need the execute bit to run directly." },
    { q: "What does `grep` do?", opts: ["Edits videos", "Searches text by pattern", "Installs apps", "Reboots"], a: 1, e: "`grep -r` finds needles in codebases fast." },
    { q: "What does a pipe (`|`) do?", opts: ["Deletes output", "Feeds one command's output into the next", "Creates files", "Opens a browser"], a: 1, e: "Pipes compose small tools into pipelines." },
  ],
  "machine learning": [
    { q: "Why split train vs test data?", opts: ["To use more disk", "To measure generalization on unseen data", "To slow training", "It is optional decoration"], a: 1, e: "Test scores reveal overfitting training scores hide." },
    { q: "What is overfitting?", opts: ["Model memorizes noise, fails on new data", "Model trains too fast", "Too little data loading", "Using GPUs"], a: 0, e: "Regularize, validate, and prefer simpler models first." },
    { q: "Features vs labels?", opts: ["Both are outputs", "Features are inputs, labels are targets to predict", "Labels are inputs", "No difference"], a: 1, e: "Models learn label = f(features)." },
  ],
  "data analysis": [
    { q: "What is a pandas DataFrame?", opts: ["A 2D labeled table for analysis", "A chart image", "A database server", "A text file"], a: 0, e: "DataFrames pair rows/columns with labeled ops." },
    { q: "Mean vs median with outliers?", opts: ["Mean is always robust", "Median resists extreme outliers", "Both ignore data", "Neither is numeric"], a: 1, e: "One billionaire skews the mean, not the median." },
    { q: "First step with nulls?", opts: ["Delete everything", "Profile missingness, then impute/drop deliberately", "Ignore them", "Ship anyway"], a: 1, e: "Measure the gap before you fill or drop it." },
  ],
  figma: [
    { q: "Why use components?", opts: ["They look fancy", "Reusable instances stay in sync", "They export code", "They delete layers"], a: 1, e: "Edit the master, update every instance." },
    { q: "Frames vs groups?", opts: ["Identical", "Frames add layout/constraints, groups just cluster", "Groups are responsive", "Frames can't nest"], a: 1, e: "Use frames for screens + auto-layout." },
    { q: "What is auto-layout for?", opts: ["Random placement", "Responsive padding/spacing that adapts", "Deleting styles", "Printing"], a: 1, e: "Auto-layout mimics flexbox inside designs." },
  ],
  communication: [
    { q: "What is active listening in a team?", opts: ["Waiting to speak", "Paraphrasing + confirming before reacting", "Multitasking in meetings", "Avoiding questions"], a: 1, e: "Reflect-back confirms you actually understood." },
    { q: "A good standup update includes?", opts: ["Life story", "Done / doing / blocked, briefly", "Complaints only", "No blockers ever"], a: 1, e: "Short + blocked-first unblocks the team." },
    { q: "Why write things down?", opts: ["To waste time", "Shared memory beats hallway decisions", "Docs are never read", "Chat is enough"], a: 1, e: "Decisions in writing survive turnover." },
  ],
  dsa: [
    { q: "What is Big-O?", opts: ["Exact runtime in seconds", "How cost grows with input size", "A sorting algorithm", "Memory brand"], a: 1, e: "O(n) vs O(n²) decides what scales." },
    { q: "Stack vs queue?", opts: ["Both are LIFO", "Stack is LIFO, queue is FIFO", "Both are FIFO", "Neither orders data"], a: 1, e: "Undo = stack; tasks = queue." },
    { q: "When does binary search work?", opts: ["On any list", "Only on sorted data", "Only on strings", "Never"], a: 1, e: "Sorted order enables O(log n) halving." },
  ],
  testing: [
    { q: "Unit vs integration test?", opts: ["Same thing", "Unit isolates one piece; integration checks them together", "Integration is always faster", "Units test UIs only"], a: 1, e: "Units catch logic bugs; integration catches wiring bugs." },
    { q: "What is a mock for?", opts: ["Making fun of code", "Replacing a dependency with a controlled stand-in", "Deleting tests", "Speeding up Wi-Fi"], a: 1, e: "Mocks isolate the unit from flaky deps." },
    { q: "When do regression tests pay off?", opts: ["Never", "When a fix or feature breaks something that used to work", "Only on day one", "When deleting the repo"], a: 1, e: "They guard shipped behavior from re-breaking." },
  ],
  "system design": [
    { q: "What does a load balancer do?", opts: ["Stores passwords", "Spreads traffic across healthy servers", "Writes code", "Deletes caches"], a: 1, e: "Balancing removes single-server bottlenecks." },
    { q: "Why add a cache?", opts: ["To slow responses", "Serve hot reads fast, reduce DB load", "To delete data", "Caches are decoration"], a: 1, e: "Cache reads like sessions/feeds at the edge." },
    { q: "What is stateless REST?", opts: ["Server remembers everything", "Each request carries its own context", "No HTTP allowed", "Only one client"], a: 1, e: "Stateless servers scale horizontally easily." },
  ],
  html: [
    { q: "Why use semantic tags (`<header>`, `<main>`)?", opts: ["They load faster magically", "Meaning + accessibility for readers/AT", "They add colors", "They replace CSS"], a: 1, e: "Semantics help screen readers and SEO." },
    { q: "Why pair `<label>` with inputs?", opts: ["Decoration", "Click targets + screen-reader names", "Validation", "Styling only"], a: 1, e: "Labels make forms usable for everyone." },
    { q: "What does the viewport meta tag do?", opts: ["Deletes mobile styles", "Makes layouts scale correctly on mobile", "Adds cookies", "Blocks zoom"], a: 1, e: "Without it, mobile renders a shrunken desktop page." },
  ],
};

/** Generic-but-distinct fallback so ANY skill (incl. custom ones) can fill up to 10/skill without repeats. */
function fallbackBankFor(skill: string): QuizBankItem[] {
  const S = skill;
  return [
    { q: `What is the primary use of ${S}?`, opts: [`Core ${S} use-case in real projects`, "Unrelated office task", "Unrelated design step", "Unrelated networking chore"], a: 0, e: `Shows working knowledge of ${S}.` },
    { q: `Which is a best practice when working with ${S}?`, opts: ["Copy-paste without understanding", `Follow official ${S} docs + small reproducible setups`, "Skip version control", `Avoid testing ${S} code`], a: 1, e: `Docs-first + versioned setups keep ${S} reliable.` },
    { q: `What is a common beginner mistake with ${S}?`, opts: [`Skipping ${S} fundamentals and jumping to advanced tricks`, `Reading ${S} docs carefully`, `Practicing ${S} in small steps`, `Asking for code review on ${S}`], a: 0, e: `Nail ${S} basics before advanced patterns.` },
    { q: `Your ${S} setup fails unexpectedly — what do you check first?`, opts: ["Buy a new laptop", `Versions, error logs, and minimal ${S} repro`, "Delete the project", "Ignore the error"], a: 1, e: `Logs + minimal repro isolate ${S} faults fast.` },
    { q: `When is ${S} the right choice?`, opts: [`When the task matches ${S} strengths`, "For every possible problem", "Never", "Only when forced"], a: 0, e: `Match the tool to the task — ${S} where it fits.` },
    { q: `Which companion habit most improves ${S} work?`, opts: ["No backups", `Version control + tests around ${S}`, `Avoiding ${S} docs`, "Working without review"], a: 1, e: `Git + tests make ${S} proof, not claims.` },
    { q: `Which statement about ${S} is true?`, opts: [`${S} rewards deliberate practice on real tasks`, `${S} is mastered by watching one video`, `${S} needs no practice`, `${S} works without any setup`], a: 0, e: `Shipped ${S} reps beat passive watching.` },
  ];
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuiz(skills: string[], perSkill = 6): QuizQ[] {
  // Per-skill semantics: EVERY selected topic gets `perSkill` distinct questions.
  // Total = topics × perSkill. No repeated question text within one quiz.
  const norm = [...new Set(
    (skills.length ? skills : ["javascript", "react", "sql"])
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  )].slice(0, 8);
  const pool = norm.length ? norm : ["javascript", "react", "sql"];
  const want = Math.min(10, Math.max(3, Math.floor(perSkill) || 6));

  // 1) Pick `want` distinct questions per skill (hand-written first, fallback fills to 10).
  const perSkillQs = new Map<string, QuizBankItem[]>();
  for (const skill of pool) {
    const full = [...(QUIZ_BANK[skill] ?? []), ...fallbackBankFor(skill)];
    const seen = new Set<string>();
    const picked: QuizBankItem[] = [];
    for (const item of shuffled(full)) {
      const key = item.q.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(item);
      if (picked.length >= want) break;
    }
    perSkillQs.set(skill, picked);
  }

  // 2) Interleave round-robin so adjacent questions are different skills.
  const out: QuizQ[] = [];
  const seenGlobal = new Set<string>();
  for (let round = 0; round < want; round++) {
    for (const skill of shuffled(pool)) {
      const list = perSkillQs.get(skill) ?? [];
      const item = list[round];
      if (!item) continue;
      const key = item.q.trim().toLowerCase();
      if (seenGlobal.has(key)) continue;
      seenGlobal.add(key);
      out.push({ id: `q${out.length}`, skill, question: item.q, options: item.opts, answer: item.a, explain: item.e });
    }
  }
  return out;
}

export function recommendRoles(profile: ParsedProfile): { role: string; why: string; lift: string }[] {
  const s = new Set(profile.skills);
  const roles: { role: string; why: string; lift: string }[] = [];
  if (s.has("react") || s.has("javascript") || s.has("html")) roles.push({ role: "Frontend Intern", why: "React/JS already detected — closest offer.", lift: "Add TypeScript + testing to hit 80%+." });
  if (s.has("python") || s.has("sql") || s.has("data analysis")) roles.push({ role: "Data Analyst Intern", why: "Python/SQL foundation present.", lift: "Add Pandas project + dashboard link." });
  if (s.has("python") || s.has("machine learning")) roles.push({ role: "ML Intern", why: "ML-adjacent skills found.", lift: "Ship one end-to-end model + deployment." });
  roles.push({ role: "Backend Intern (Node/Python)", why: "API + DB + Git transfer well.", lift: "Docker + AWS turns it deployable." });
  return roles.slice(0, 4);
}

export function readiness(profile: ParsedProfile | null, avgMatch: number | null, verified: number): number {
  if (!profile) return 8;
  let r = 30 + profile.skills.length * 3 + verified * 4;
  if (avgMatch) r += avgMatch * 0.25;
  if (profile.projects.length >= 2) r += 8;
  return Math.max(5, Math.min(96, Math.round(r)));
}
