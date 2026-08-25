"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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
            <Image
              src="/icon.png"
              alt="Independent YouTube Playlist Manager logo"
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          <span className="font-bold text-xs tracking-tight text-zinc-900 group-hover:text-red-600 transition-colors sm:hidden">
            IYPM
          </span>
          <span className="font-bold text-xs sm:text-sm md:text-base tracking-tight text-zinc-900 group-hover:text-red-600 transition-colors hidden sm:inline">
            Independent YouTube Playlist Manager
          </span>
        </Link>
      </div>
    </header>
  );
}
