import React from "react";
import { Check, Minus, X } from "lucide-react";

type Level = "yes" | "partial" | "no";

type Cell = {
  text: string;
  level: Level;
};

type Row = {
  feature: string;
  iypm: Cell;
  native: Cell;
};

type Group = {
  name: string;
  rows: Row[];
};

const groups: Group[] = [
  {
    name: "Playlist Creation & Organization",
    rows: [
      {
        feature: "Create unlimited playlists",
        iypm: { text: "Unlimited, no account required", level: "yes" },
        native: { text: "Requires a Google account", level: "partial" },
      },
      {
        feature: "Batch-add multiple videos",
        iypm: { text: "Add dozens in one click", level: "yes" },
        native: { text: "One video at a time", level: "no" },
      },
      {
        feature: "Tab Harvester (open tabs)",
        iypm: { text: "Grab YouTube tabs from all windows", level: "yes" },
        native: { text: "Not possible", level: "no" },
      },
      {
        feature: "Extract IDs from text / HTML / clipboard",
        iypm: { text: "Paste links, HTML source, or text blocks", level: "yes" },
        native: { text: "Not possible", level: "no" },
      },
      {
        feature: "Quick-add toolbar popup",
        iypm: { text: "One-click queue from the toolbar", level: "yes" },
        native: { text: "Not available", level: "no" },
      },
      {
        feature: "Right-click context menus",
        iypm: { text: "Add links from YouTube search pages", level: "yes" },
        native: { text: "Not available", level: "no" },
      },
    ],
  },
  {
    name: "Editing & Bulk Operations",
    rows: [
      {
        feature: "Drag-and-drop reordering",
        iypm: { text: "Reorder playlists freely", level: "yes" },
        native: { text: "Limited manual reordering", level: "partial" },
      },
      {
        feature: "Bulk select & delete",
        iypm: { text: "Multi-select and batch delete", level: "yes" },
        native: { text: "Delete one video at a time", level: "no" },
      },
      {
        feature: "Merge playlists",
        iypm: { text: "Combine two playlists into one", level: "yes" },
        native: { text: "Not possible", level: "no" },
      },
      {
        feature: "Split playlists",
        iypm: { text: "Split one playlist into several", level: "yes" },
        native: { text: "Not possible", level: "no" },
      },
      {
        feature: "Duplicate removal",
        iypm: { text: "Automatic de-duplication", level: "yes" },
        native: { text: "Manual only", level: "no" },
      },
      {
        feature: "Smart sorting",
        iypm: { text: "Sort by title, channel, date, and more", level: "yes" },
        native: { text: "Default order only", level: "partial" },
      },
      {
        feature: "Reverse order",
        iypm: { text: "One-click reverse", level: "yes" },
        native: { text: "Not possible", level: "no" },
      },
      {
        feature: "Search within playlists",
        iypm: { text: "Instant local search", level: "yes" },
        native: { text: "Basic search only", level: "partial" },
      },
      {
        feature: "Pagination for large lists",
        iypm: { text: "Handles thousands of videos smoothly", level: "yes" },
        native: { text: "Lazy-loading only", level: "partial" },
      },
    ],
  },
  {
    name: "Import, Export & Portability",
    rows: [
      {
        feature: "JSON backup",
        iypm: { text: "Full database backup (Schema v2)", level: "yes" },
        native: { text: "Not possible", level: "no" },
      },
      {
        feature: "CSV export",
        iypm: { text: "Spreadsheet-ready export", level: "yes" },
        native: { text: "Not possible", level: "no" },
      },
      {
        feature: "M3U export",
        iypm: { text: "Playable in VLC & media players", level: "yes" },
        native: { text: "Not possible", level: "no" },
      },
      {
        feature: "Restore / import backup",
        iypm: { text: "Merge or overwrite restore modes", level: "yes" },
        native: { text: "Not possible", level: "no" },
      },
      {
        feature: "Data ownership",
        iypm: { text: "Your data lives on your machine", level: "yes" },
        native: { text: "Locked into the Google ecosystem", level: "no" },
      },
    ],
  },
  {
    name: "Metadata & Offline",
    rows: [
      {
        feature: "Works offline",
        iypm: { text: "IndexedDB + local storage", level: "yes" },
        native: { text: "Requires connection & session", level: "no" },
      },
      {
        feature: "Video metadata (title, channel, duration)",
        iypm: { text: "Zero-quota multi-tier fetch engine", level: "yes" },
        native: { text: "Automatic, but Google-controlled", level: "partial" },
      },
      {
        feature: "Local metadata cache",
        iypm: { text: "Multi-gigabyte IndexedDB cache", level: "yes" },
        native: { text: "No local control", level: "no" },
      },
      {
        feature: "Custom metadata engines",
        iypm: { text: "Configurable Invidious / Piped instances", level: "yes" },
        native: { text: "Not applicable", level: "no" },
      },
      {
        feature: "Thumbnails & descriptions",
        iypm: { text: "Cached locally for instant access", level: "yes" },
        native: { text: "Streamed from YouTube", level: "partial" },
      },
    ],
  },
  {
    name: "Sync & Cross-Device",
    rows: [
      {
        feature: "Cross-device sync",
        iypm: { text: "Optional: encrypted Supabase + YouTube OAuth", level: "partial" },
        native: { text: "Built-in via Google account", level: "yes" },
      },
      {
        feature: "Account independence",
        iypm: { text: "Data not tied to any single account", level: "yes" },
        native: { text: "Tied to one Google account", level: "no" },
      },
      {
        feature: "No API quota for local use",
        iypm: { text: "Zero-quota scraping pipeline", level: "yes" },
        native: { text: "No control (N/A)", level: "partial" },
      },
      {
        feature: "Sync resume on quota limit",
        iypm: { text: "Auto-resume over days, no duplicates", level: "yes" },
        native: { text: "N/A", level: "no" },
      },
    ],
  },
  {
    name: "Privacy, Openness & Platform",
    rows: [
      {
        feature: "Data collection",
        iypm: { text: "Zero telemetry, zero tracking", level: "yes" },
        native: { text: "Google collects usage data", level: "no" },
      },
      {
        feature: "Login required",
        iypm: { text: "Not required for basic use", level: "yes" },
        native: { text: "Google account required", level: "no" },
      },
      {
        feature: "Open source",
        iypm: { text: "MIT license, fully auditable", level: "yes" },
        native: { text: "Proprietary, closed source", level: "no" },
      },
      {
        feature: "Permissions scope",
        iypm: { text: "Strictly youtube.com watch pages", level: "yes" },
        native: { text: "Broad Google account scope", level: "partial" },
      },
      {
        feature: "Platform support",
        iypm: { text: "Chrome, Firefox Desktop, Firefox Android", level: "yes" },
        native: { text: "Web + mobile apps only", level: "partial" },
      },
      {
        feature: "Cost",
        iypm: { text: "100% free & open source", level: "yes" },
        native: { text: "Free (ad-supported ecosystem)", level: "yes" },
      },
    ],
  },
];

function LevelIcon({ level }: { level: Level }) {
  if (level === "yes") {
    return <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" aria-hidden="true" />;
  }
  if (level === "partial") {
    return <Minus className="h-4 w-4 text-amber-500 flex-shrink-0" aria-hidden="true" />;
  }
  return <X className="h-4 w-4 text-red-500 flex-shrink-0" aria-hidden="true" />;
}

function CellView({ cell }: { cell: Cell }) {
  return (
    <span className="inline-flex items-start gap-2 leading-snug">
      <LevelIcon level={cell.level} />
      <span className="text-zinc-700">{cell.text}</span>
    </span>
  );
}

export function ComparisonSection() {
  return (
    <section className="py-14 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
            IYPM vs Native YouTube Playlists
          </h2>
          <p className="mt-3 text-zinc-600 text-sm sm:text-base max-w-2xl mx-auto">
            See at a glance what you gain by switching to a client-side, open-source playlist
            manager — every capability compared side by side.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 mb-8 text-xs text-zinc-500 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            Supported
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Minus className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            Limited / optional
          </span>
          <span className="inline-flex items-center gap-1.5">
            <X className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
            Not available
          </span>
        </div>

        {/* Table (desktop / tablet) */}
        <div className="hidden sm:block overflow-x-auto rounded-2xl border border-zinc-200 shadow-sm">
          <table className="w-full text-sm min-w-[720px] border-collapse">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-4 bg-zinc-50 font-semibold text-zinc-900 border-b border-zinc-200 w-[26%] align-bottom">
                  Capability
                </th>
                <th className="px-4 py-4 bg-red-50 text-red-700 font-bold border-b border-red-200 w-[37%] align-bottom">
                  <span className="inline-flex items-baseline gap-1.5">
                    IYPM
                    <span className="text-[11px] font-normal text-red-500">(this extension)</span>
                  </span>
                </th>
                <th className="px-4 py-4 bg-zinc-50 font-semibold text-zinc-700 border-b border-zinc-200 w-[37%] align-bottom">
                  Native YouTube Playlists
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <React.Fragment key={group.name}>
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-2.5 bg-zinc-100/70 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-y border-zinc-200"
                    >
                      {group.name}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.feature} className="odd:bg-white even:bg-zinc-50/40">
                      <td className="px-4 py-3 font-medium text-zinc-900 border-b border-zinc-100 align-top">
                        {row.feature}
                      </td>
                      <td className="px-4 py-3 border-b border-zinc-100 bg-red-50/40 border-l border-l-red-100 align-top">
                        <CellView cell={row.iypm} />
                      </td>
                      <td className="px-4 py-3 border-b border-zinc-100 align-top">
                        <CellView cell={row.native} />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards (icon-only, abbreviated labels) */}
        <div className="sm:hidden space-y-6">
          {groups.map((group) => (
            <div key={group.name}>
              <h3 className="px-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                {group.name}
              </h3>
              <div className="space-y-2">
                {group.rows.map((row) => (
                  <div key={row.feature} className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="text-sm font-medium text-zinc-900 leading-snug">
                      {row.feature}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div
                        className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5"
                        title={row.iypm.text}
                      >
                        <LevelIcon level={row.iypm.level} />
                        <span className="text-xs font-semibold text-red-700">IYPM</span>
                      </div>
                      <div
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-50 border border-zinc-100 px-2.5 py-1.5"
                        title={row.native.text}
                      >
                        <LevelIcon level={row.native.level} />
                        <span className="text-xs font-semibold text-zinc-600">Native</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
