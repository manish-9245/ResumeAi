"use client";
import React from "react";
import { Play, Pause } from "lucide-react";

/** Hero product tour: click-to-play video with a single play/pause control. */
export function HeroVideo() {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }

  return (
    <div className="relative w-full">
      <video
        ref={ref}
        preload="metadata"
        playsInline
        aria-label="ResumeAI product tour video (24 seconds)"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onClick={toggle}
        className="aspect-video w-full cursor-pointer bg-[#0E1525]"
        src="/brag.mp4"
      />
      <button
        onClick={toggle}
        aria-label={playing ? "Pause product tour video" : "Play product tour video"}
        className={`absolute grid place-items-center rounded-full text-white shadow-xl transition-all focus-visible:outline-2 ${
          playing
            ? "bottom-3 left-3 h-11 w-11 opacity-80 hover:opacity-100"
            : "left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 hover:scale-105"
        }`}
        style={{ background: "rgba(43,92,255,.92)" }}
      >
        {playing ? <Pause size={20} /> : <Play size={26} className="ml-1" />}
      </button>
    </div>
  );
}
