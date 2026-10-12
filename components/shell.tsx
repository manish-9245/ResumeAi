"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { readiness } from "@/lib/analysis";
import { FullPageLoader } from "./loading";
import {
  LayoutDashboard, UploadCloud, Briefcase, Map, BadgeCheck, MessagesSquare, User, Home, Trash2, LogOut,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/jobs", label: "Jobs & Match", icon: Briefcase },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/quiz", label: "Verify Quiz", icon: BadgeCheck },
  { href: "/assistant", label: "Assistant", icon: MessagesSquare },
  { href: "/profile", label: "Profile", icon: User },
];

export function ScoreDial({ value, size = 132, label }: { value: number; size?: number; label?: string }) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), 80);
    return () => clearTimeout(t);
  }, [value]);
  const ang = Math.round((v / 100) * 360);
  const color = v >= 75 ? "#0E9F6E" : v >= 55 ? "#2B5CFF" : v >= 35 ? "#B45309" : "#DC2626";
  return (
    <div className="flex flex-col items-center gap-2" role="img" aria-label={`${label ?? "Score"} ${value} percent`}>
      <div
        className="dial-sweep grid place-items-center rounded-full"
        style={{
          width: size, height: size,
          background: `conic-gradient(${color} ${ang}deg, #E8EDF6 0deg)`,
        }}
      >
        <div className="grid place-items-center rounded-full bg-white" style={{ width: size - 22, height: size - 22 }}>
          <div className="text-center">
            <div className="font-data font-bold" style={{ fontSize: 30, color }}>{v}%</div>
            {label && <div className="text-[11px] font-medium tracking-wide" style={{ color: "#3F4A63" }}>{label}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Meter({ value, color }: { value: number; color?: string }) {
  const [w, setW] = React.useState(0);
  React.useEffect(() => { const t = setTimeout(() => setW(value), 60); return () => clearTimeout(t); }, [value]);
  return <div className="meter"><span style={{ width: `${w}%`, background: color ?? "#2B5CFF" }} /></div>;
}

export function AppShell({ children, title, sub, requireAuth = false }: { children: React.ReactNode; title: string; sub?: string; requireAuth?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const { profile, avgMatch, verifiedCount, clearAll, hydrated, cloudSync } = useApp();
  const { user, loading, signOut } = useAuth();
  const ready = readiness(profile, avgMatch, verifiedCount);

  React.useEffect(() => {
    if (requireAuth && !loading && !user) {
      router.replace(`/auth?next=${encodeURIComponent(path ?? "/dashboard")}`);
    }
  }, [requireAuth, loading, user, router, path]);

  async function handleSignOut() {
    clearAll();
    await signOut();
    router.replace("/auth");
  }

  const shell = (body: React.ReactNode) => (
    <div className="flex min-h-screen">
      <aside className="sidebar-desktop fixed inset-y-0 left-0 z-30 flex h-dvh w-[264px] flex-col gap-4 overflow-hidden border-r p-5" style={{ background: "#FFFFFF", color: "#0E1525", borderColor: "#E2E8F2" }}>
        <Link href="/" className="flex shrink-0 items-center gap-2.5 px-1" aria-label="ResumeAI home">
          <Image src="/logo.png" alt="ResumeAI logo" width={36} height={36} className="rounded-[10px]" priority />
          <span>
            <span className="font-display block text-[17px] font-bold leading-none">ResumeAI</span>
            <span className="font-data block text-[10px] tracking-[.14em]" style={{ color: "#7A86A3" }}>CAREER INSTRUMENT</span>
          </span>
        </Link>
        <div className="font-data shrink-0 px-3 text-[10px] font-bold tracking-[.18em]" style={{ color: "#7A86A3" }}>WORKSPACE</div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1" aria-label="Primary">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                data-active={active}
                className="rail-link group relative flex items-center gap-2.5 px-3 py-2.5 text-[14px] font-medium"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full transition-all"
                  style={{ background: "#7D8CFF", opacity: active ? 1 : 0 }}
                />
                <Icon size={17} strokeWidth={2.2} /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="grid w-full min-w-0 shrink-0 gap-2.5 overflow-hidden rounded-[12px] border p-3.5" style={{ background: "#F4F6FB", borderColor: "#E2E8F2" }}>
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-display grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: "#2B5CFF" }} aria-hidden>
              {(user?.email ?? profile?.name ?? "?").trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex items-center gap-1.5">
                <span className="block truncate text-[12px] font-semibold" title={user?.email ?? ""}>{user ? user.email : "Not signed in"}</span>
                {user && (
                  <span title={cloudSync ? "Synced across your devices" : "Local only — syncing…"} aria-label={cloudSync ? "Synced" : "Syncing"}
                    className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cloudSync ? "#0E9F6E" : "#B45309" }} />
                )}
              </span>
              <span className="block truncate text-[11px]" style={{ color: "#3F4A63" }}>{profile ? profile.name : "No resume yet"}</span>
            </span>
            {profile && (
              <button onClick={clearAll} title="Reset my workspace data" aria-label="Reset my workspace data" className="shrink-0 rounded-lg p-1.5 hover:bg-black/5" style={{ color: "#7A86A3" }}>
                <Trash2 size={14} />
              </button>
            )}
            {user && (
              <button onClick={handleSignOut} title="Sign out" aria-label="Sign out" className="shrink-0 rounded-lg p-1.5 hover:bg-black/5" style={{ color: "#7A86A3" }}>
                <LogOut size={14} />
              </button>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] font-medium" style={{ color: "#3F4A63" }}>
              <span>Readiness</span>
              <span className="font-data text-[12px] font-bold" style={{ color: "#0E1525" }}>{ready}%</span>
            </div>
            <div className="mt-1.5"><Meter value={ready} /></div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[264px]">
        <div className="nav-mobile flex items-center gap-2 overflow-x-auto border-b p-3" style={{ borderColor: "#E2E8F2", background: "#fff" }}>
          <Link href="/" className="mr-1 flex items-center gap-1.5 text-[13px] font-bold"><Home size={15} /> ResumeAI</Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium" style={{ borderColor: path === n.href ? "#2B5CFF" : "#E2E8F2", background: path === n.href ? "#2B5CFF" : "#fff", color: path === n.href ? "#fff" : "#0E1525" }}>{n.label}</Link>
          ))}
        </div>
        <main key={path} className="page-enter mx-auto w-full max-w-[1120px] flex-1 px-4 py-8 sm:px-6">
          <header className="mb-6">
            <h1 className="font-display text-[28px] font-bold tracking-[-0.02em]">{title}</h1>
            {sub && <p className="mt-1 max-w-[70ch] text-[14px] leading-6" style={{ color: "#3F4A63" }}>{sub}</p>}
          </header>
          {body}
        </main>
      </div>
    </div>
  );

  if (requireAuth && (loading || !hydrated)) {
    return shell(<FullPageLoader status="Verifying session" />);
  }

  if (requireAuth && !user) {
    return shell(
      <div className="card mx-auto grid max-w-[460px] gap-3 p-8 text-center">
        <div className="font-display text-[19px] font-bold">Sign in to continue</div>
        <p className="text-[13.5px]" style={{ color: "#3F4A63" }}>
          Your resumes, matches and quizzes are private to your account. Sign in to open your isolated workspace.
        </p>
        <Link href={`/auth?next=${encodeURIComponent(path ?? "/dashboard")}`} className="btn-primary px-5 py-3 text-center text-[14px]">Go to sign in</Link>
      </div>
    );
  }

  return shell(children);
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card grid gap-2 p-8 text-center">
      <div className="font-display text-[18px] font-bold">{title}</div>
      <p className="mx-auto max-w-[52ch] text-[14px]" style={{ color: "#3F4A63" }}>{body}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function Chip({ tone, children }: { tone: "have" | "partial" | "missing" | "high" | "medium" | "low" | "info"; children: React.ReactNode }) {
  const map: Record<string, React.CSSProperties> = {
    have: { background: "#E6F7EE", color: "#0B7A55" },
    partial: { background: "#FFF4D6", color: "#92580A" },
    missing: { background: "#FDE8E8", color: "#B42323" },
    high: { background: "#FDE8E8", color: "#B42323" },
    medium: { background: "#FFF4D6", color: "#92580A" },
    low: { background: "#E9EDF7", color: "#3F4A63" },
    info: { background: "#E4EBFF", color: "#1E40D8" },
  };
  return <span className="font-data inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide" style={map[tone]}>{children}</span>;
}
