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
  return { email, phone, links: [...linkSet].slice(0, 5) };
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

  const education = entriesFromSection(sections.education ?? [], 5, 160);
  let experience = entriesFromSection(sections.experience ?? [], 6, 180);
  let projects = entriesFromSection(sections.projects ?? [], 6, 180);
  const certifications = entriesFromSection(sections.certifications ?? [], 5, 140);

  // Fallback for header-less pastes: keyword capture so fragments still analyze.
  if (Object.keys(sections).length === 0) {
    const scan = (keys: string[]) => {
      const out: string[] = [];
      for (const l of lines) {
        if (keys.some((k) => l.toLowerCase().includes(k))) {
          const c = l.replace(/\s+/g, " ").trim();
          if (c.length > 10) out.push(c.slice(0, 180));
          if (out.length >= 5) break;
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

export function scoreHealth(profile: ParsedProfile, rawText: string): HealthResult {
  const issues: HealthResult["issues"] = [];
  const strengths: string[] = [];
  let score = 62;

  if (profile.skills.length >= 6) { score += 10; strengths.push(`${profile.skills.length} detectable skills`); }
  else issues.push({ section: "Skills", severity: profile.skills.length === 0 ? "critical" : "warn", message: `Only ${profile.skills.length} skills detected`, fix: "Add a Skills section with 8–12 job-relevant keywords." });

  if (profile.projects.length >= 2) { score += 8; strengths.push("2+ projects show build ability"); }
  else issues.push({ section: "Projects", severity: "warn", message: "Fewer than 2 projects with outcomes", fix: "Add 2 projects with stack + metric (e.g. cut load time 40%)." });

  if (profile.experience.length >= 1) { score += 6; strengths.push("Experience present"); }
  else issues.push({ section: "Experience", severity: "warn", message: "No internship/experience bullets", fix: "Add internship, freelance, or club work — even 1 entry helps." });

  if (profile.education.length && !profile.education[0].startsWith("Add")) { score += 4; }
  else issues.push({ section: "Education", severity: "warn", message: "Education vague", fix: "Degree + college + year + CGPA on one line." });

  if (/\d+%|\d+x|reduced|improved|built|shipped/i.test(rawText)) { score += 5; strengths.push("Quantified impact found"); }
  else issues.push({ section: "Impact", severity: "warn", message: "No numbers or outcomes", fix: "Add 3 metrics: users, speed, accuracy, downloads." });

  if (rawText.length < 800) issues.push({ section: "Depth", severity: "critical", message: "Resume very short (<800 chars)", fix: "Aim for 1 full page — add projects + skills." });
  if (rawText.length > 6000) { score -= 4; issues.push({ section: "Length", severity: "warn", message: "Overlong — recruiters skim", fix: "Cut to 1 page, keep newest 3 items." }); }

  if (profile.certifications.length) { score += 3; strengths.push("Certifications verify learning"); }
  if (/linkedin|github|portfolio/i.test(rawText)) { score += 2; strengths.push("Links present"); }
  else issues.push({ section: "Links", severity: "warn", message: "No GitHub/LinkedIn/portfolio links", fix: "Add live links — JDs click them." });

  score = Math.max(18, Math.min(96, score));
  return { score, issues, strengths };
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

const QUIZ_BANK: Record<string, { q: string; opts: string[]; a: number; e: string }[]> = {
  javascript: [{ q: "What does `===` check that `==` does not?", opts: ["Value only", "Value + type without coercion", "Reference only", "Nothing"], a: 1, e: "`===` skips type coercion — fewer bugs." }],
  react: [{ q: "Where should data-fetching side effects live?", opts: ["In render body", "In useEffect / event handlers", "In JSX props", "In CSS"], a: 1, e: "Effects belong in useEffect/handlers, not render." }],
  python: [{ q: "What is a list comprehension?", opts: ["A loop that builds a list inline", "A dict type", "A test runner", "A server"], a: 0, e: "`[x for x in ...]` builds lists concisely." }],
  sql: [{ q: "What does JOIN do?", opts: ["Deletes rows", "Combines rows across tables on a key", "Sorts files", "Encrypts data"], a: 1, e: "JOINs relate tables via keys." }],
  docker: [{ q: "What is a Docker image?", opts: ["A running process", "An immutable template containers start from", "A VM", "A log file"], a: 1, e: "Images are templates; containers are running instances." }],
  git: [{ q: "What does `git rebase` do?", opts: ["Deletes repo", "Replays commits onto a new base", "Pushes to cloud", "Merges PDFs"], a: 1, e: "Rebase rewrites history onto a new base — keep it clean on shared branches." }],
};

export function buildQuiz(skills: string[], n = 6): QuizQ[] {
  const out: QuizQ[] = [];
  const pool = skills.length ? skills : ["javascript", "react", "sql"];
  let i = 0;
  while (out.length < n && i < n * 3) {
    const skill = pool[i % pool.length];
    const bank = QUIZ_BANK[skill] ?? [{ q: `What is the primary use of ${skill}?`, opts: [`Core ${skill} use-case`, "Unrelated A", "Unrelated B", "Unrelated C"], a: 0, e: `Shows working knowledge of ${skill}.` }];
    const b = bank[0];
    out.push({ id: `q${i}`, skill, question: b.q, options: b.opts, answer: b.a, explain: b.e });
    i++;
  }
  return out.slice(0, n);
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
