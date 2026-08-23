"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { GithubIcon } from "@/components/icons/BrandIcons";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    fetch("https://api.github.com/repos/el-musleh/independent-youtube-playlist-manager")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.stargazers_count === "number") {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        scrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-zinc-200/80 shadow-sm py-2.5"
          : "bg-transparent py-3.5"
      }`}
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group cursor-pointer touch-target-44"
          aria-label="Independent YouTube Playlist Manager — Home"
        >
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl overflow-hidden shadow-sm flex items-center justify-center flex-shrink-0 bg-white border border-zinc-200/80 group-hover:scale-105 transition-transform duration-200">
            <Image src="/icon.png" alt="Independent YouTube Playlist Manager logo" width={28} height={28} className="object-contain" />
          </div>
          <span className="font-bold text-xs sm:text-sm md:text-base tracking-tight text-zinc-900 group-hover:text-red-600 transition-colors truncate max-w-[180px] sm:max-w-none">
            Independent YouTube Playlist Manager
          </span>
        </Link>

        {/* GitHub Star Button — inline at every breakpoint */}
        <a
          href="https://github.com/el-musleh/independent-youtube-playlist-manager"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 hover:border-zinc-300 transition-colors shadow-sm touch-target-44"
        >
          <GithubIcon className="h-4 w-4 text-zinc-600 flex-shrink-0" />
          <span className="text-zinc-300 select-none">|</span>
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 flex-shrink-0" />
          <span className="hidden sm:inline">Star</span>
          {stars !== null && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-150 text-[10px] text-zinc-500 font-mono font-bold">
              {stars}
            </span>
          )}
        </a>
      </div>
    </header>
  );
}
