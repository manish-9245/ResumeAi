"use client";
import React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { PwaInstallButton } from "./pwa";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/quiz", label: "Quiz" },
  { href: "/auth", label: "Sign in" },
];

/** Mobile-only hamburger menu for the floating landing nav. */
export function MobileMenu() {
  const [open, setOpen] = React.useState(false);
  const btn = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    const onClick = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open ]);

  return (
    <span className="md:hidden">
      <button
        ref={btn}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      {open && (
        <div
          ref={panel}
          className="absolute inset-x-4 top-[68px] z-50 grid gap-1 rounded-2xl border p-3 shadow-xl"
          style={{ borderColor: "#E2E8F2", background: "rgba(255,255,255,.97)", backdropFilter: "blur(14px)" }}
        >
          {LINKS.map((l) => (
            <Link
              key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="rounded-[10px] px-3.5 py-2.5 text-[14px] font-semibold hover:bg-black/5"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/upload" onClick={() => setOpen(false)}
            className="btn-primary mt-1 min-h-[44px] px-3.5 py-2.5 text-center text-[14px]"
          >
            Analyze resume
          </Link>
          <PwaInstallButton
            className="mt-1 min-h-[44px] rounded-[12px] border px-3.5 py-2.5 text-center text-[14px] font-bold"
            style={{ borderColor: "#0E9F6E", background: "#E6F7EE", color: "#0B7A55" }}
          />
        </div>
      )}
    </span>
  );
}
