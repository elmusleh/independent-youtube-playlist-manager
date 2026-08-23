"use client";

import React from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import { GithubIcon } from "@/components/icons/BrandIcons";

export default function Home() {
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
            <Image src="/icon.png" alt="Independent YouTube Playlist Manager logo" width={56} height={56} className="object-contain" />
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
              Build, edit, and sync YouTube playlists directly in your browser — no server dependencies, 
              no API quota limits, and 100% client-side privacy.
            </p>
          </div>

          {/* Install / Source Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md mx-auto pt-2">
            <Button
              variant="glow"
              size="lg"
              className="w-full sm:w-auto h-11 px-6 font-bold text-xs sm:text-sm shadow-md shadow-red-600/10 touch-target-44"
              onClick={() => window.open("https://chromewebstore.google.com/", "_blank")}
            >
              <Image src="/chrome.svg" alt="Chrome Logo" width={16} height={16} className="mr-2 flex-shrink-0" />
              Add to Chrome
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-11 px-6 font-semibold text-xs sm:text-sm bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-800 touch-target-44"
              onClick={() => window.open("https://addons.mozilla.org/firefox/addon/youtube-playlist-helper/", "_blank")}
            >
              <Image src="/firefox.svg" alt="Firefox Logo" width={16} height={16} className="mr-2 flex-shrink-0" />
              <span className="flex flex-col items-start leading-none">
                <span>Add to Firefox</span>
                <span className="mt-1 text-[10px] font-normal text-zinc-500">Desktop &amp; Android</span>
              </span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-11 px-6 font-semibold text-xs sm:text-sm bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-800 touch-target-44 gap-2"
              onClick={() => window.open("https://github.com/el-musleh/youtube-playlist-helper", "_blank")}
            >
              <GithubIcon className="h-4 w-4 flex-shrink-0" />
              View Source
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
