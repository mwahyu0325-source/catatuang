"use client";

import { useEffect, useState } from "react";

/** Tombol terang/gelap. Tema awal diterapkan oleh script inline di layout. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("cu-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark ?? false}
      aria-label={dark ? "Ubah ke tema terang" : "Ubah ke tema gelap"}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-soft hover:text-ink transition-colors"
    >
      {dark === null ? null : dark ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M13 3l-1.1 1.1M4.1 11.9L3 13M13 13l-1.1-1.1M4.1 4.1L3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
