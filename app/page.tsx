import Link from "next/link";
import Image from "next/image";
import { Outfit } from "next/font/google";
import { ArrowRight, ArrowUpRight, FileUp, Crosshair, Map, BadgeCheck, MessagesSquare, FlaskConical } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa";
import { MobileMenu } from "@/components/mobile-nav";
import { HeroEnter, ScaleFade, PinSplit, Marquee } from "@/components/landing-motion";
import { ScoreDial, Chip } from "@/components/shell";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const MARQUEE = ["React", "Python", "TypeScript", "SQL", "Docker", "Node.js", "AWS", "Machine Learning", "Git", "Data Analysis", "Testing", "System Design"];

const SLICES = [
  { icon: FileUp, title: "Upload", copy: "PDF parsed in your browser. Health score with exact fixes, not vibes.", href: "/upload" },
  { icon: Crosshair, title: "Match", copy: "Paste any JD. Have, partial and missing skills, scored to the percent.", href: "/jobs" },
  { icon: Map, title: "Roadmap", copy: "What-first ordering with a shippable project per skill gap.", href: "/roadmap" },
  { icon: BadgeCheck, title: "Verify", copy: "A per-skill quiz that checks your resume claims hold up.", href: "/quiz" },
  { icon: MessagesSquare, title: "Ask", copy: "A profile-aware assistant for gaps, roles and direction.", href: "/assistant" },
];

function GapRow({ skill, tone, note }: { skill: string; tone: "have" | "partial" | "missing"; note: string }) {
  const color = tone === "have" ? "#0E9F6E" : tone === "partial" ? "#B45309" : "#DC2626";
  return (
    <div className="flex items-center gap-3 rounded-[10px] border px-3 py-2.5" style={{ borderColor: "#E2E8F2" }}>
      <span className="font-data text-[13px] font-bold">{skill}</span>
      <span className="font-data text-[10px] font-bold uppercase" style={{ color }}>{tone}</span>
      <span className="ml-auto hidden text-[12px] sm:block" style={{ color: "#3F4A63" }}>{note}</span>
    </div>
  );
}

export default function Landing() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "ResumeAI",
        url: "/",
        description: "Resume health scoring, job matching, skill-gap roadmaps and verification quizzes for students.",
      },
      {
        "@type": "SoftwareApplication",
        name: "ResumeAI",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: "Upload one PDF and get a resume health score, job-match percentages, skill gaps, a learning roadmap and quizzes.",
      },
    ],
  };
  return (
    <main className={`${outfit.className} w-full max-w-full overflow-x-hidden`} style={{ background: "#F4F6FB", color: "#0E1525" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Floating glass nav */}
      <div className="fixed inset-x-0 top-4 z-40 flex justify-center px-4">
        <nav aria-label="Site" className="flex w-full max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border py-2 pl-3 pr-2 shadow-lg sm:max-w-fit" style={{ borderColor: "rgba(226,232,242,.9)", background: "rgba(255,255,255,.78)", backdropFilter: "blur(14px)" }}>
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2" aria-label="ResumeAI home">
            <Image src="/logo.png" alt="ResumeAI logo" width={30} height={30} className="rounded-[8px]" priority />
            <span className="text-[15px] font-bold">ResumeAI</span>
          </Link>
          <span className="hidden items-center gap-1 md:flex">
            <Link href="/dashboard" className="rounded-full px-3 py-1.5 text-[13px] font-medium hover:bg-black/5">Dashboard</Link>
            <Link href="/jobs" className="rounded-full px-3 py-1.5 text-[13px] font-medium hover:bg-black/5">Jobs</Link>
            <Link href="/roadmap" className="rounded-full px-3 py-1.5 text-[13px] font-medium hover:bg-black/5">Roadmap</Link>
          </span>
          <MobileMenu />
          <PwaInstallButton className="hidden rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold sm:block" style={{ borderColor: "#0E9F6E", background: "#E6F7EE", color: "#0B7A55" }} />
          <Link href="/upload" className="btn-primary ml-auto whitespace-nowrap rounded-full px-4 py-2 text-[13px] sm:ml-0">Analyze resume</Link>
        </nav>
      </div>

      {/* ATTENTION — cinematic center hero */}
      <section className="relative overflow-hidden px-5 pb-16 pt-32 sm:pb-24 sm:pt-36 md:pt-44" aria-label="Introduction">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-60" style={{ background: "radial-gradient(closest-side, #D7E0FF, transparent)" }} />
          <div className="absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full opacity-40" style={{ background: "radial-gradient(closest-side, #C4F0DD, transparent)" }} />
          <div className="absolute -right-40 top-1/4 h-[420px] w-[420px] rounded-full opacity-40" style={{ background: "radial-gradient(closest-side, #FFE9B8, transparent)" }} />
        </div>
        <HeroEnter className="relative mx-auto grid max-w-6xl justify-items-center gap-6 text-center sm:gap-7">
          <h1 className="w-full max-w-6xl text-balance font-extrabold leading-[1.08] tracking-[-0.02em]" style={{ fontSize: "clamp(2.25rem, 9vw, 5.25rem)" }}>
            Your resume, measured
            <br />
            like an{" "}
            <span className="mx-1 inline-flex h-[0.82em] w-[2.1em] items-center justify-center rounded-full align-middle" style={{ background: "conic-gradient(#0E9F6E 259deg, #DCE5F5 0deg)" }} aria-hidden>
              <span className="font-data grid h-[0.62em] w-[1.7em] place-items-center rounded-full bg-white text-[#0B7A55]" style={{ fontSize: "0.32em" }}>72%</span>
            </span>{" "}
            instrument.
          </h1>
          <p className="max-w-[62ch] text-balance text-[15px] leading-7 sm:text-[16px] sm:leading-8 md:text-[18px]" style={{ color: "#3F4A63" }}>
            Upload one PDF. Get a health score, exact job-match percentages, missing skills with why they matter, a learn-first roadmap, and a quiz that proves you can do what you claim. Grounded in your real experience.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
            <Link href="/upload" className="btn-primary flex min-h-[48px] items-center justify-center gap-2 px-7 py-3.5 text-[15px]">
              Analyze my resume <ArrowRight size={17} />
            </Link>
            <Link href="/dashboard" className="flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] border px-7 py-3.5 text-[15px] font-semibold" style={{ borderColor: "#E2E8F2", background: "#fff", color: "#0E1525" }}>
              See a live sample
            </Link>
          </div>
          <ScaleFade className="w-full max-w-4xl">
            <div className="card grid min-w-0 gap-3 p-4 text-left shadow-xl sm:p-5 md:p-6" style={{ background: "#fff" }} aria-label="Sample dossier preview">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
                <div className="flex justify-center sm:shrink-0"><ScoreDial value={72} label="JOB MATCH" size={120} /></div>
                <div className="min-w-0 flex-1 sm:min-w-[220px]">
                  <div className="font-data text-[10px] font-bold tracking-[.14em]" style={{ color: "#3F4A63" }}>SAMPLE · SYNTHETIC</div>
                  <div className="break-words text-[17px] font-bold sm:text-[19px]">Aarav Sharma — Frontend Intern</div>
                  <div className="mt-1.5 grid gap-2">
                    <GapRow skill="Docker" tone="missing" note="Ships identically everywhere." />
                    <GapRow skill="TypeScript" tone="partial" note="Type-safety signal for prod teams." />
                    <GapRow skill="React" tone="have" note="Verified in resume." />
                  </div>
                </div>
              </div>
              <div className="rounded-[10px] border p-3.5 text-[13px] font-medium" style={{ background: "#EAF0FF", borderColor: "#C9D6FF" }}>
                What-if: learn <b>Docker</b> → match <span className="font-data font-bold" style={{ color: "#1E40D8" }}>72% → 84%</span> <span style={{ color: "#3F4A63" }}>(simulated)</span>
              </div>
            </div>
          </ScaleFade>
        </HeroEnter>
      </section>

      {/* Marquee — GSAP-driven, pauses on hover */}
      <div className="border-y py-5" style={{ borderColor: "#E2E8F2", background: "#fff" }} aria-hidden>
        <Marquee duration={26}>
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center gap-8 pr-8 whitespace-nowrap" aria-hidden={copy === 1}>
              {MARQUEE.map((s) => (
                <span key={`${copy}-${s}`} className="font-data text-[15px] font-bold tracking-wide" style={{ color: "#3F4A63" }}>
                  {s} <span className="ml-8" style={{ color: "#2B5CFF" }}>·</span>
                </span>
              ))}
            </div>
          ))}
        </Marquee>
      </div>

      {/* INTEREST — gapless bento */}
      <section className="px-5 py-16 sm:py-24 md:py-48" aria-label="What ResumeAI does">
        <div className="mx-auto max-w-[1160px]">
          <div className="mb-8 grid items-end gap-4 sm:mb-12 sm:gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <h2 className="max-w-[16ch] text-balance font-extrabold leading-[1.08] tracking-[-0.02em]" style={{ fontSize: "clamp(1.9rem, 7vw, 3.6rem)" }}>
              One upload. Every answer.
            </h2>
            <p className="max-w-[46ch] text-[14px] leading-7 sm:text-[15px]" style={{ color: "#3F4A63" }}>
              Four instruments, one shared profile. Nothing invented, everything tied to the lines on your page.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-6 md:[grid-auto-flow:dense]">
            <Link href="/upload" className="card group min-w-0 overflow-hidden p-5 transition-shadow hover:shadow-xl sm:p-7 md:col-span-4" style={{ background: "#fff" }}>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <h3 className="text-[19px] font-bold sm:text-[22px]">Health, scored honestly</h3>
                <ArrowUpRight size={20} className="shrink-0 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: "#2B5CFF" }} />
              </div>
              <p className="mt-2 max-w-[52ch] text-[13.5px] leading-6 sm:text-[14px]" style={{ color: "#3F4A63" }}>Weak sections named with exact fixes. Links checked, impact quantified, fluff flagged.</p>
              <div className="mt-5 overflow-hidden rounded-[12px]" style={{ background: "#F4F6FB" }}>
                <div className="grid gap-2 transition-transform duration-700 ease-out group-hover:scale-[1.02]">
                  <div className="flex items-center justify-between px-4 pt-3 text-[12px] font-semibold" style={{ color: "#3F4A63" }}><span>IMPACT</span><span className="font-data">+5</span></div>
                  <div className="px-4 pb-4"><div className="meter"><span style={{ width: "78%", background: "#0E9F6E" }} /></div></div>
                </div>
              </div>
            </Link>
            <Link href="/jobs" className="card group grid min-w-0 content-between gap-6 overflow-hidden p-5 transition-shadow hover:shadow-xl sm:p-7 md:col-span-2" style={{ background: "#fff" }}>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <h3 className="text-[19px] font-bold sm:text-[22px]">Job match</h3>
                <ArrowUpRight size={20} className="shrink-0 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: "#2B5CFF" }} />
              </div>
              <div className="overflow-hidden">
                <div className="font-data font-extrabold transition-transform duration-700 ease-out group-hover:scale-105" style={{ fontSize: "clamp(2.8rem, 12vw, 4.6rem)", color: "#2B5CFF", lineHeight: 1 }}>72%</div>
                <p className="mt-2 text-[13.5px]" style={{ color: "#3F4A63" }}>Have · partial · missing, per JD.</p>
              </div>
            </Link>
            <Link href="/jobs" className="card group grid min-w-0 content-between gap-6 overflow-hidden p-5 transition-shadow hover:shadow-xl sm:p-7 md:col-span-2" style={{ background: "#fff" }}>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <h3 className="text-[19px] font-bold sm:text-[22px]">What-if simulator</h3>
                <FlaskConical size={20} className="shrink-0" style={{ color: "#B45309" }} />
              </div>
              <div className="overflow-hidden">
                <div className="font-data font-extrabold transition-transform duration-700 ease-out group-hover:scale-105" style={{ fontSize: "clamp(1.9rem, 8vw, 3rem)", lineHeight: 1.1 }}>72 → 84<span style={{ color: "#0E9F6E" }}>%</span></div>
                <p className="mt-2 text-[13.5px]" style={{ color: "#3F4A63" }}>Preview the lift before you spend three weeks.</p>
              </div>
            </Link>
            <Link href="/roadmap" className="card group min-w-0 overflow-hidden p-5 transition-shadow hover:shadow-xl sm:p-7 md:col-span-4" style={{ background: "#fff" }}>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <h3 className="text-[19px] font-bold sm:text-[22px]">A roadmap that ends in proof</h3>
                <ArrowUpRight size={20} className="shrink-0 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" style={{ color: "#2B5CFF" }} />
              </div>
              <div className="mt-5 grid gap-3 overflow-hidden transition-transform duration-700 ease-out group-hover:scale-[1.01] sm:grid-cols-3">
                {[
                  ["Docker", "Week 1–2", "Ship a containerized app"],
                  ["TypeScript", "Week 3–4", "Migrate one project"],
                  ["Testing", "Week 5", "Green CI badge on GitHub"],
                ].map(([s, w, p]) => (
                  <div key={s} className="min-w-0 rounded-[12px] border p-4" style={{ borderColor: "#E2E8F2", background: "#F7F9FF" }}>
                    <div className="font-data text-[10px] font-bold" style={{ color: "#3F4A63" }}>{w.toUpperCase()}</div>
                    <div className="mt-1 break-words text-[15px] font-bold">{s}</div>
                    <div className="text-[12.5px]" style={{ color: "#3F4A63" }}>{p}</div>
                  </div>
                ))}
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* DESIRE — pinned method story */}
      <section className="border-y px-5 py-16 sm:py-24 md:py-48" style={{ background: "#fff", borderColor: "#E2E8F2" }} aria-label="How it works">
        <div className="mx-auto max-w-[1160px]">
          <PinSplit
            left={
              <div className="grid min-w-0 gap-5">
                <h2 className="text-balance font-extrabold leading-[1.08] tracking-[-0.02em]" style={{ fontSize: "clamp(1.9rem, 7vw, 3.6rem)" }}>
                  The method in three moves.
                </h2>
                <p className="max-w-[44ch] text-[14px] leading-7 sm:text-[15px]" style={{ color: "#3F4A63" }}>
                  No black boxes. Each move reads the same parsed profile, so the plan never contradicts the score.
                </p>
                <Link href="/upload" className="btn-primary flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] px-6 py-3 text-[14px] sm:w-fit">
                  Start with move one <ArrowRight size={15} />
                </Link>
              </div>
            }
            right={
              <>
                {[
                  { t: "Drop the PDF", d: "Parsed in your browser, structured by AI. Name, skills, dates and links land in one profile.", tag: "MOVE ONE" },
                  { t: "Compare honestly", d: "Paste any JD or pick a live listing. See have, partial and missing — with why each gap matters.", tag: "MOVE TWO" },
                  { t: "Prove it", d: "Follow the roadmap, ship the project, pass the quiz. Re-run the match and watch it move.", tag: "MOVE THREE" },
                ].map((s) => (
                  <div key={s.t} className="min-w-0 rounded-2xl border p-5 transition-shadow hover:shadow-lg sm:p-7" style={{ borderColor: "#E2E8F2", background: "#F7F9FF" }}>
                    <div className="font-data text-[11px] font-bold tracking-[.16em]" style={{ color: "#1E40D8" }}>{s.tag}</div>
                    <div className="mt-2 text-[20px] font-bold sm:text-[24px]">{s.t}</div>
                    <p className="mt-2 max-w-[48ch] text-[13.5px] leading-6 sm:text-[14px]" style={{ color: "#3F4A63" }}>{s.d}</p>
                  </div>
                ))}
              </>
            }
          />
        </div>
      </section>

      {/* Atlas — horizontal accordions */}
      <section className="mx-auto max-w-[1160px] px-5 py-16 sm:py-24 md:py-48" aria-label="Everything included">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
          <h2 className="max-w-[16ch] text-balance font-extrabold leading-[1.08] tracking-[-0.02em]" style={{ fontSize: "clamp(1.9rem, 7vw, 3.6rem)" }}>
            Pick up any instrument.
          </h2>
          <Link href="/dashboard" className="flex min-h-[40px] items-center gap-1.5 text-[14px] font-bold" style={{ color: "#2B5CFF" }}>
            Open the full workspace <ArrowRight size={15} />
          </Link>
        </div>
        <div className="flex flex-col gap-3 md:h-[400px] md:flex-row">
          {SLICES.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.title} href={s.href}
                className="group relative min-w-0 flex-1 overflow-hidden rounded-2xl border p-5 transition-all duration-700 ease-out sm:p-6 md:hover:flex-[2.4]"
                style={{ borderColor: "#E2E8F2", background: "#fff" }}
              >
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-0 transition-opacity duration-700 group-hover:opacity-100" style={{ background: "radial-gradient(closest-side, #D7E0FF, transparent)" }} />
                <span className="grid h-11 w-11 place-items-center rounded-[12px]" style={{ background: "#E4EBFF", color: "#1E40D8" }}>
                  <Icon size={20} />
                </span>
                <div className="mt-4 text-[22px] font-bold sm:text-[26px]">{s.title}</div>
                <p className="mt-2 max-w-[40ch] text-[13.5px] leading-6 transition-all duration-500 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100" style={{ color: "#3F4A63" }}>
                  {s.copy}
                </p>
                <span className="mt-3 inline-flex min-h-[32px] items-center gap-1 text-[13px] font-bold transition-all duration-500 md:opacity-0 md:group-hover:opacity-100" style={{ color: "#2B5CFF" }}>
                  Open <ArrowUpRight size={14} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ACTION — massive CTA + footer */}
      <section className="px-5 pb-10" aria-label="Get started">
        <div className="mx-auto max-w-[1160px] overflow-hidden rounded-[20px] px-5 py-14 text-center shadow-xl sm:rounded-[28px] sm:px-6 sm:py-20 md:py-28" style={{ background: "#2B5CFF", color: "#fff" }}>
          <h2 className="mx-auto w-full max-w-5xl text-balance font-extrabold leading-[1.06] tracking-[-0.02em]" style={{ fontSize: "clamp(2rem, 9vw, 4.8rem)" }}>
            Stop guessing. Start measuring.
          </h2>
          <p className="mx-auto mt-5 max-w-[54ch] text-balance text-[14px] leading-7 sm:text-[15px]" style={{ color: "rgba(255,255,255,.82)" }}>
            Free for college work. Your data stays yours, scores stay honest, and the plan starts with one upload.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Link href="/upload" className="flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] px-8 py-4 text-[15px] font-bold" style={{ background: "#fff", color: "#0E1525" }}>
              Analyze my resume <ArrowRight size={16} />
            </Link>
            <Link href="/auth" className="flex min-h-[48px] items-center justify-center rounded-[12px] border px-8 py-4 text-[15px] font-bold" style={{ borderColor: "rgba(255,255,255,.5)", color: "#fff" }}>
              Create account
            </Link>
          </div>
        </div>
        <footer className="mx-auto flex max-w-[1160px] flex-col gap-x-6 gap-y-3 px-1 py-8 text-[13px] sm:flex-row sm:flex-wrap sm:items-center" style={{ color: "#3F4A63" }}>
          <span className="flex items-center gap-2 font-bold" style={{ color: "#0E1525" }}>
            <Image src="/logo.png" alt="ResumeAI logo" width={22} height={22} className="rounded-[6px]" /> ResumeAI
          </span>
          <span className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/dashboard" className="min-h-[32px] inline-flex items-center hover:underline">Dashboard</Link>
          <Link href="/jobs" className="min-h-[32px] inline-flex items-center hover:underline">Jobs</Link>
          <Link href="/roadmap" className="min-h-[32px] inline-flex items-center hover:underline">Roadmap</Link>
          <Link href="/quiz" className="min-h-[32px] inline-flex items-center hover:underline">Quiz</Link>
          </span>
          <span className="sm:ml-auto">Scores are guidance, never verdicts. Your PDF stays private.</span>
        </footer>
      </section>
    </main>
  );
}
