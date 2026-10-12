"use client";
import React from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { AppShell, Empty, Chip, Meter } from "@/components/shell";
import type { ParsedProfile, SkillLevel } from "@/lib/types";
import {
  GraduationCap, Briefcase, Rocket, Award, Mail, UserRound, Phone,
  Plus, Check, ShieldCheck, Pencil, ArrowRight, Sparkles, Trash2, Link2, RefreshCw, CloudOff,
} from "lucide-react";

const LEVELS: { id: SkillLevel; label: string; hint: string }[] = [
  { id: "beginner", label: "Learning", hint: "Used in tutorials" },
  { id: "intermediate", label: "Working", hint: "Shipped in projects" },
  { id: "advanced", label: "Strong", hint: "Can teach / interview" },
];

function completeness(d: { name: string; email: string; education: string[]; skills: string[]; projects: string[]; experience: string[]; certifications: string[] }): { pct: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [d.name !== "Candidate", "Add your name"],
    [d.email.length > 0, "Add contact email"],
    [!(d.education.length === 1 && d.education[0].startsWith("Add")) && d.education.length > 0, "Complete education"],
    [d.skills.length >= 5, "List 5+ skills"],
    [d.projects.length >= 2, "Add 2+ projects"],
    [d.experience.length >= 1, "Add experience"],
    [d.certifications.length >= 1, "Add a certification"],
  ];
  const have = checks.filter(([ok]) => ok).length;
  return { pct: Math.round((have / checks.length) * 100), missing: checks.filter(([ok]) => !ok).map(([, m]) => m) };
}

/** Inline-editable entry list: tap text to edit, ✕ to delete, + to add. */
function EditableEntries({ items, onChange, addLabel, emptyHint }: {
  items: string[]; onChange: (v: string[]) => void; addLabel: string; emptyHint: string;
}) {
  const [editing, setEditing] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [newItem, setNewItem] = React.useState("");

  function commitEdit(i: number) {
    const v = draft.trim();
    if (v) onChange(items.map((x, k) => (k === i ? v.slice(0, 220) : x)));
    setEditing(null);
  }

  function commitAdd() {
    const v = newItem.trim();
    if (v) onChange([...items, v.slice(0, 220)]);
    setNewItem(""); setAdding(false);
  }

  return (
    <div className="grid gap-2">
      {items.map((item, i) => (
        <div key={`${i}-${item.slice(0, 12)}`} className="group rounded-[10px] border px-3 py-1.5" style={{ borderColor: "#E2E8F2" }}>
          {editing === i ? (
            <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(i); if (e.key === "Escape") setEditing(null); }}
              onBlur={() => commitEdit(i)} aria-label="Edit entry"
              className="w-full rounded-md border px-2 py-1.5 text-[13px]" style={{ borderColor: "#2B5CFF" }} />
          ) : (
            <div className="flex items-start gap-2">
              <button onClick={() => { setDraft(item); setEditing(i); }} title="Edit" aria-label="Edit entry"
                className="min-w-0 flex-1 py-1 text-left text-[13px] leading-5 hover:text-[#1E40D8]">{item}</button>
              <button onClick={() => onChange(items.filter((_, k) => k !== i))} title="Delete" aria-label="Delete entry"
                className="shrink-0 rounded-md p-1 opacity-0 hover:bg-red-50 focus:opacity-100 group-hover:opacity-100" style={{ color: "#DC2626" }}>
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && (
        <p className="rounded-[10px] px-3.5 py-2.5 text-[13px]" style={{ background: "#FFF8E6", color: "#92580A" }}>{emptyHint}</p>
      )}
      {adding ? (
        <div className="flex gap-2">
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} autoFocus placeholder={addLabel}
            onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") setAdding(false); }}
            aria-label={addLabel} className="flex-1 rounded-[10px] border px-3 py-2 text-[13px]" style={{ borderColor: "#2B5CFF" }} />
          <button onClick={commitAdd} aria-label="Add" className="btn-primary px-3.5"><Check size={15} /></button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-[10px] border border-dashed px-3 py-2 text-[12.5px] font-bold hover:border-[#2B5CFF]" style={{ borderColor: "#E2E8F2", color: "#3F4A63" }}>
          <Plus size={13} /> {addLabel}
        </button>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { profile, setResume, resumeText, fullHealth, avgMatch } = useApp();
  const { user } = useAuth();
  const [name, setName] = React.useState(profile?.name ?? "");
  const [editingName, setEditingName] = React.useState(false);
  const [email, setEmail] = React.useState(profile?.email ?? "");
  const [phone, setPhone] = React.useState(profile?.phone ?? "");
  const [links, setLinks] = React.useState<string[]>(profile?.links ?? []);
  const [newLink, setNewLink] = React.useState("");
  const [edu, setEdu] = React.useState<string[]>(profile?.education ?? []);
  const [exp, setExp] = React.useState<string[]>(profile?.experience ?? []);
  const [proj, setProj] = React.useState<string[]>(profile?.projects ?? []);
  const [certs, setCerts] = React.useState<string[]>(profile?.certifications ?? []);
  const [skills, setSkills] = React.useState<string[]>(profile?.skills ?? []);
  const [levels, setLevels] = React.useState<Record<string, SkillLevel>>(profile?.skillLevels ?? {});
  const [newSkill, setNewSkill] = React.useState("");
  const [saved, setSaved] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const [sync, setSync] = React.useState<null | {
    tables: Record<string, { ok: boolean; detail?: string; count?: number }>;
    missing: string[];
  }>(null);
  const [checking, setChecking] = React.useState(false);
  const [showOk, setShowOk] = React.useState(false);

  async function checkSync(announce = false) {
    setChecking(true);
    try {
      const r = await fetch("/api/sync-status");
      const j = await r.json();
      if (j.signedIn) {
        const missing: string[] = j.missing ?? [];
        setSync({ tables: j.tables ?? {}, missing });
        // Green confirmation is transient and only on explicit recheck.
        if (missing.length === 0 && announce) {
          setShowOk(true);
          setTimeout(() => setShowOk(false), 8000);
        } else if (missing.length > 0) {
          setShowOk(false);
        }
      }
      else setSync(null);
    } catch { /* offline — card stays hidden */ }
    finally { setChecking(false); }
  }

  React.useEffect(() => { checkSync(false); }, []);

  const resetAll = React.useCallback(() => {
    if (!profile) return;
    setName(profile.name); setEmail(profile.email ?? ""); setPhone(profile.phone ?? ""); setLinks(profile.links ?? []);
    setEdu(profile.education); setExp(profile.experience); setProj(profile.projects); setCerts(profile.certifications);
    setSkills(profile.skills); setLevels(profile.skillLevels ?? {});
    setDirty(false); setEditingName(false);
  }, [profile]);

  React.useEffect(() => { resetAll(); }, [resetAll, profile?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  function mark() { setDirty(true); }

  function save() {
    if (!profile) return;
    const next: ParsedProfile = {
      ...profile,
      name: name.trim() || profile.name, email: email.trim(), phone: phone.trim(), links,
      education: edu, experience: exp, projects: proj, certifications: certs,
      skills, skillLevels: levels,
    };
    setResume(resumeText, next, fullHealth); // store syncs to cloud (same device + others)
    setDirty(false); setEditingName(false);
    // Honest confirmation: only claim cross-device sync after the server proves it.
    setSaved("Saving…");
    setTimeout(async () => {
      try {
        const r = await fetch("/api/sync-status");
        const j = await r.json();
        const missing: string[] = j.missing ?? ["unknown"];
        setSaved(missing.length === 0 ? "Saved — synced across your devices" : "Saved on this device only — cloud sync is off (see panel above)");
        if (j.signedIn) setSync({ tables: j.tables ?? {}, missing });
      } catch {
        setSaved(user ? "Saved — will sync when you're back online" : "Saved");
      }
      setTimeout(() => setSaved(""), 4000);
    }, 900);
  }

  if (!profile) return <AppShell requireAuth title="Profile" sub="Education, skills + levels, experience, projects, certifications — one source of truth."><Empty title="No profile yet" body="Your profile is created automatically when you analyze a resume." action={<a href="/upload" className="btn-primary px-5 py-3 text-[14px]">Upload resume</a>} /></AppShell>;

  const { pct, missing } = completeness({ name, email, education: edu, skills, projects: proj, experience: exp, certifications: certs });
  const skilled = (lvl: SkillLevel) => skills.filter((s) => (levels[s] ?? "beginner") === lvl);

  const sections = [
    { icon: GraduationCap, label: "Education", items: edu, set: setEdu, add: "Add education", empty: "No education yet — degree, college, year, CGPA." },
    { icon: Briefcase, label: "Experience", items: exp, set: setExp, add: "Add experience", empty: "No experience yet — internships, clubs and freelance all count." },
    { icon: Rocket, label: "Projects", items: proj, set: setProj, add: "Add project", empty: "No projects yet — 2 proof-of-build projects change everything." },
    { icon: Award, label: "Certifications", items: certs, set: setCerts, add: "Add certification", empty: "No certifications — one verified course beats three claims." },
  ];

  return (
    <AppShell requireAuth title="Candidate profile" sub="Everything here is editable — fix our parsing mistakes in place. Roadmap, quiz and assistant read from this.">
      {/* Identity header */}
      <div className="card card-elev rise grid gap-5 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center" style={{ background: "#fff" }}>
        <span className="font-display grid h-16 w-16 place-items-center rounded-2xl text-[26px] font-extrabold text-white" style={{ background: "#2B5CFF" }} aria-hidden>
          {(name || profile.name).trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {editingName ? (
              <input value={name} onChange={(e) => { setName(e.target.value); mark(); }} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false); }}
                className="font-display w-full max-w-[280px] rounded-[10px] border px-2.5 py-1 text-[20px] font-bold" style={{ borderColor: "#2B5CFF" }} aria-label="Display name" />
            ) : (
              <span className="font-display text-[22px] font-bold">{name || profile.name}</span>
            )}
            <button onClick={() => setEditingName(!editingName)} aria-label="Edit name"
              className="rounded-lg p-1.5 hover:bg-black/5" style={{ color: "#3F4A63" }}>
              {editingName ? <Check size={15} /> : <Pencil size={14} />}
            </button>
          </div>
          <div className="mt-1.5 grid max-w-[420px] gap-1.5 sm:grid-cols-2">
            <label className="flex items-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-[12px]" style={{ borderColor: "#E2E8F2", background: "#F7F9FF" }}>
              <Mail size={12} className="shrink-0" style={{ color: "#7A86A3" }} />
              <input value={email} onChange={(e) => { setEmail(e.target.value); mark(); }} placeholder="email@example.com" aria-label="Contact email"
                className="w-full min-w-0 bg-transparent" style={{ color: "#0E1525" }} />
            </label>
            <label className="flex items-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-[12px]" style={{ borderColor: "#E2E8F2", background: "#F7F9FF" }}>
              <Phone size={12} className="shrink-0" style={{ color: "#7A86A3" }} />
              <input value={phone} onChange={(e) => { setPhone(e.target.value); mark(); }} placeholder="+91 …" aria-label="Phone"
                className="w-full min-w-0 bg-transparent" style={{ color: "#0E1525" }} />
            </label>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Link2 size={12} style={{ color: "#7A86A3" }} />
            {links.map((l) => (
              <span key={l} className="font-data flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: "#EAF0FF", color: "#1E40D8" }}>
                {l.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                <button onClick={() => { setLinks(links.filter((x) => x !== l)); mark(); }} aria-label={`Remove ${l}`} className="hover:opacity-70">✕</button>
              </span>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); const v = newLink.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""); if (v && !links.includes(v)) { setLinks([...links, v]); mark(); } setNewLink(""); }}
              className="flex items-center gap-1">
              <input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="+ add link" aria-label="Add link"
                className="font-data w-28 rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: "#E2E8F2" }} />
            </form>
            <span className="ml-auto flex items-center gap-1.5 text-[12px]" style={{ color: "#3F4A63" }}><UserRound size={13} /> {user?.email ?? "local workspace"}</span>
            {avgMatch !== null && <span className="font-data text-[12px] font-bold" style={{ color: "#1E40D8" }}>AVG {avgMatch}%</span>}
          </div>
        </div>
        <div className="grid w-full gap-1.5 sm:w-[190px]">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="font-data tracking-[.12em] text-[#8B95B0]">COMPLETE</span>
            <span className="font-data text-white">{pct}%</span>
          </div>
          <Meter value={pct} color={pct >= 70 ? "#0E9F6E" : "#7D8CFF"} />
          <span className="text-[11.5px] text-[#8B95B0]">{missing[0] ? `Next: ${missing[0].toLowerCase()}` : "Looking complete — keep verifying."}</span>
        </div>
      </div>

      {dirty && (
        <div className="rise sticky top-3 z-10 mt-3 flex items-center gap-3 rounded-[12px] border px-4 py-3" style={{ borderColor: "#2B5CFF", background: "#E4EBFF" }} role="status">
          <Sparkles size={16} color="#1E40D8" />
          <span className="text-[13px] font-semibold" style={{ color: "#1E40D8" }}>Unsaved changes</span>
          <button onClick={resetAll} className="ml-auto text-[13px] font-bold" style={{ color: "#3F4A63" }}>Discard</button>
          <button onClick={save} className="btn-primary px-4 py-2 text-[13px]">Save profile</button>
        </div>
      )}

      {sync && sync.missing.length > 0 && (
        <div className="card mt-3 border p-5" style={{ borderColor: "#DC2626", background: "#FFF5F5" }} role="alert">
          <div className="flex items-center gap-2 font-display text-[15.5px] font-bold" style={{ color: "#B42323" }}>
            <CloudOff size={17} /> Cloud sync is off — your data stays on this device only
          </div>
          <p className="mt-1.5 max-w-[70ch] text-[13px] leading-6" style={{ color: "#3F4A63" }}>
            {sync.missing.length === 7
              ? "None of the app tables exist in your Supabase project yet. Run supabase/schema.sql in your Supabase dashboard (SQL editor), then tap Recheck."
              : `These tables are unreachable: ${sync.missing.join(", ")}. ${sync.missing.some((m) => /relation .* does not exist|Could not find/i.test(sync.tables[m]?.detail ?? "")) ? "Re-run supabase/schema.sql in your Supabase dashboard (SQL editor), then tap Recheck." : "Check RLS policies and table permissions, then tap Recheck."}`}
          </p>
          <button onClick={() => checkSync(true)} disabled={checking} className="btn-primary mt-3 flex items-center gap-1.5 px-4 py-2.5 text-[13px] disabled:opacity-60">
            <RefreshCw size={14} className={checking ? "animate-spin" : ""} /> {checking ? "Checking…" : "Recheck sync"}
          </button>
        </div>
      )}

      {sync && sync.missing.length === 0 && showOk && (
        <button onClick={() => setShowOk(false)} title="Dismiss"
          className="mt-3 flex w-full flex-wrap items-center gap-2 rounded-[12px] border px-4 py-2.5 text-left text-[12.5px] font-medium" style={{ borderColor: "#0E9F6E", background: "#E6F7EE", color: "#0B7A55" }}>
          <Check size={14} /> Cloud sync on — profile{(sync.tables.profiles?.count ?? 0) > 0 ? "" : " (not saved yet)"}, {sync.tables.chat_sessions?.count ?? 0} chats, {sync.tables.job_matches?.count ?? 0} matches stored. Same account, any device.
          <span className="ml-auto font-bold">✕</span>
        </button>
      )}

      <div className="mt-3 grid items-start gap-3 lg:grid-cols-[1fr_1.1fr]">
        {/* Dossier — all editable */}
        <div className="grid gap-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <section key={s.label} className="card rise p-5" aria-label={s.label}>
                <header className="mb-3 flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: "#E4EBFF", color: "#1E40D8" }}><Icon size={17} /></span>
                  <h2 className="font-display text-[15.5px] font-bold">{s.label}</h2>
                  <span className="font-data ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "#F0F3F9", color: "#3F4A63" }}>{s.items.length}</span>
                </header>
                <EditableEntries items={s.items} onChange={(v) => { s.set(v); mark(); }} addLabel={s.add} emptyHint={s.empty} />
              </section>
            );
          })}
          <div className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "#3F4A63" }}>
            <ShieldCheck size={14} color="#0E9F6E" /> Tap any entry to correct it — re-upload only for a fresh start.
            <Link href="/upload" className="ml-auto flex items-center gap-1 font-bold" style={{ color: "#2B5CFF" }}>Re-analyze <ArrowRight size={13} /></Link>
          </div>
        </div>

        {/* Skills matrix */}
        <section className="card card-elev rise rise-1 p-5 sm:p-6" aria-label="Skills and levels">
          <header className="flex items-center justify-between">
            <h2 className="font-display text-[16px] font-bold">Skills matrix</h2>
            <span className="font-data text-[11px] font-bold" style={{ color: "#3F4A63" }}>{skills.length} SKILLS</span>
          </header>
          <p className="mt-1 text-[12.5px]" style={{ color: "#3F4A63" }}>Set each honestly — the quiz will test exactly this. Only list what you can demo.</p>

          <div className="mt-4 grid gap-2">
            {skills.map((s) => {
              const lvl = levels[s] ?? "beginner";
              return (
                <div key={s} className="grid gap-2 rounded-[12px] border p-3" style={{ borderColor: lvl === "advanced" ? "#0E9F6E" : lvl === "intermediate" ? "#2B5CFF" : "#E2E8F2", background: lvl === "beginner" ? "#fff" : lvl === "intermediate" ? "#F7F9FF" : "#F4FBF7" }}>
                  <div className="flex items-center gap-2">
                    <span className="font-data text-[13.5px] font-bold">{s}</span>
                    <button onClick={() => { setSkills(skills.filter((x) => x !== s)); mark(); }}
                      className="ml-auto rounded-md px-1.5 py-0.5 text-[12px] font-bold hover:bg-red-50" style={{ color: "#DC2626" }} aria-label={`Remove ${s}`}>✕</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 rounded-[10px] p-1" style={{ background: "#F0F3F9" }} role="radiogroup" aria-label={`${s} level`}>
                    {LEVELS.map((l) => {
                      const on = lvl === l.id;
                      return (
                        <button key={l.id} role="radio" aria-checked={on}
                          onClick={() => { setLevels({ ...levels, [s]: l.id }); mark(); }}
                          className="rounded-[8px] px-2 py-1.5 transition-all" title={l.hint}
                          style={on ? { background: "#0B1220", color: "#fff" } : { color: "#3F4A63" }}>
                          <span className="block text-[11.5px] font-bold">{l.label}</span>
                          <span className="block text-[10px] opacity-70">{l.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {skills.length === 0 && (
              <p className="rounded-[10px] px-3.5 py-3 text-[13px]" style={{ background: "#FDE8E8", color: "#B42323" }}>No skills yet — add your first below, or re-upload a richer resume.</p>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); const v = newSkill.trim().toLowerCase(); if (v && !skills.includes(v)) { setSkills([...skills, v]); setLevels({ ...levels, [v]: "beginner" }); setNewSkill(""); mark(); } }}
            className="mt-3 flex gap-2">
            <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill you can demo…" aria-label="Add skill"
              className="flex-1 rounded-[12px] border px-3.5 py-2.5 text-[13px]" style={{ borderColor: "#E2E8F2" }} />
            <button className="flex items-center gap-1.5 rounded-[12px] border px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: "#2B5CFF", color: "#1E40D8" }}><Plus size={14} /> Add</button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["advanced", "intermediate", "beginner"] as SkillLevel[]).map((l) => (
              <Chip key={l} tone={l === "advanced" ? "have" : l === "intermediate" ? "info" : "low"}>
                {skilled(l).length} {l}
              </Chip>
            ))}
            <Chip tone="info">privacy: yours only</Chip>
          </div>

          <button onClick={save} className="btn-primary mt-4 w-full py-3 text-[14px]">
            {dirty ? "Save changes" : "Saved ✓"}
          </button>
          {saved && <div className="mt-2 text-center text-[13px] font-medium" style={{ color: "#0B7A55" }} role="status">{saved}</div>}
        </section>
      </div>
    </AppShell>
  );
}
