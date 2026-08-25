export const headline = "Independent YouTube Playlist Manager";
export const subheadline =
  "Take full control of your YouTube experience with a privacy-first, client-side playlist manager that syncs across devices — no servers, no quotas, no compromises.";

export const features = [
  {
    title: "100% Client-Side Privacy",
    description:
      "All data stays in your browser. No tracking, no telemetry, no data leaves your device unless you choose to sync.",
  },
  {
    title: "Zero API Quota Worries",
    description:
      "Innovative scraping techniques let you fetch metadata without consuming YouTube API quota.",
  },
  {
    title: "Cross-Device Sync (Optional)",
    description: "Encrypted sync via Supabase keeps your playlists available on all your browsers.",
  },
  {
    title: "Open Source & Transparent",
    description: "Fully auditable code, no hidden processes, community-driven.",
  },
  {
    title: "Advanced Playlist Editing",
    description: "Drag-and-drop, bulk operations, smart sorting, and duplicate removal.",
  },
  {
    title: "Offline-First Design",
    description: "Works seamlessly even when you're offline, syncing when back online.",
  },
];

export const howItWorks = [
  { step: 1, description: "Install the extension from Chrome Web Store or Firefox Add-ons." },
  {
    step: 2,
    description: "Navigate to any YouTube page — the manager overlay appears automatically.",
  },
  {
    step: 3,
    description: "Add videos to your playlist with one click, or import existing playlists.",
  },
  { step: 4, description: "Organize, edit, and sync your playlists across devices." },
];

export const faq = [
  {
    question: "Does this extension collect any of my data?",
    answer:
      "Absolutely not. All processing happens locally in your browser. We never access your YouTube history, recommendations, or personal data unless you explicitly choose to sync (and even then, it's end-to-end encrypted).",
  },
  {
    question: "How does it work without YouTube API quota?",
    answer:
      "We use a combination of client-side techniques — including embedded page scraping, innertube requests, and oEmbed — to fetch video metadata without touching the official YouTube API quota.",
  },
  {
    question: "Is my data safe when syncing across devices?",
    answer:
      "Yes. Sync uses Supabase with end-to-end encryption. Only you hold the keys; not even we can access your synced data.",
  },
  {
    question: "Is it really free and open source?",
    answer:
      "Yes. The extension is 100% free, open source (MIT license), and hosted on GitHub. No premium tiers, no hidden payments.",
  },
  {
    question: "Does it work on mobile Firefox (Fenix)?",
    answer: "Yes. We support Firefox for Android (Fenix) with the same privacy guarantees.",
  },
];

export const privacyTrust = [
  "All video metadata processing occurs client-side — no external servers involved unless you opt-in to sync.",
  "No telemetry, no analytics, no tracking scripts of any kind.",
  "Open source code available for auditing on GitHub.",
  "Optional sync is end-to-end encrypted; we never see your data.",
  "Regular security audits and community scrutiny.",
];
