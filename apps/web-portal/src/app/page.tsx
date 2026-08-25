"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Sparkles, Star } from "lucide-react";
import Image from "next/image";

export default function Home() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/elmusleh/independent-youtube-playlist-manager")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.stargazers_count === "number") {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-mesh-light text-zinc-800 w-full overflow-x-hidden selection:bg-red-500/10 selection:text-red-900">
      {/* Navigation Bar */}
      <Navbar />

      {/* Main View */}
      <main className="flex-1 w-full overflow-x-hidden flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center space-y-8 animate-in fade-in duration-500 relative">
          {/* Background Accent Glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[500px] h-[280px] sm:h-[400px] bg-red-500/5 blur-[100px] rounded-full pointer-events-none -z-10" />

          {/* Official Logo */}
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl overflow-hidden shadow-md flex items-center justify-center border border-zinc-200 bg-white group hover:scale-105 transition-transform duration-300">
            <Image
              src="/icon.png"
              alt="Independent YouTube Playlist Manager logo"
              width={56}
              height={56}
              className="object-contain"
            />
          </div>

          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/5 text-red-600 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Browser Extension</span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 leading-tight">
              Independent YouTube Playlist Manager
            </h1>
            <p className="text-zinc-600 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
              Build, edit, and sync YouTube playlists directly in your browser — no server
              dependencies, no API quota limits, and 100% client-side privacy.
            </p>
          </div>

          {/* Install Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xl mx-auto pt-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-11 px-6 font-semibold text-xs sm:text-sm bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-800 touch-target-44 whitespace-nowrap"
              onClick={() =>
                window.open(
                  "https://chromewebstore.google.com/detail/dapjjdcnolpmfcnobilphjfpkmmokgid",
                  "_blank"
                )
              }
            >
              <Image
                src="/chrome.svg"
                alt="Chrome Logo"
                width={16}
                height={16}
                className="mr-2 flex-shrink-0"
              />
              Add to Chrome
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-11 px-6 font-semibold text-xs sm:text-sm bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-800 touch-target-44 whitespace-nowrap"
              onClick={() =>
                window.open("https://addons.mozilla.org/en-US/firefox/addon/iypm/", "_blank")
              }
            >
              <Image
                src="/firefox.svg"
                alt="Firefox Logo"
                width={16}
                height={16}
                className="mr-2 flex-shrink-0"
              />
              <span className="flex flex-col items-start leading-none">
                <span>Add to Firefox</span>
                <span className="mt-1 text-[10px] font-normal text-zinc-500">
                  Desktop & Android
                </span>
              </span>
            </Button>
          </div>

          {/* GitHub Source Button */}
          <div className="w-full max-w-xl mx-auto flex justify-center mt-6">
            <button
              className="inline-flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] border backdrop-blur-sm shadow-sm rounded-xl w-full sm:w-auto h-11 px-6 font-semibold text-xs sm:text-sm bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white touch-target-44 whitespace-nowrap gap-2"
              onClick={() =>
                window.open(
                  "https://github.com/elmusleh/independent-youtube-playlist-manager",
                  "_blank"
                )
              }
            >
              <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"></path>
              </svg>
              View Source
              <span className="text-zinc-600 select-none">|</span>
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 flex-shrink-0" />
              <span className="ml-0.5 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300 font-mono font-bold">
                {stars ?? 0}
              </span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
