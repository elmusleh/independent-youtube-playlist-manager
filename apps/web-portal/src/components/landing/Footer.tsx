import React from "react";

const LAST_UPDATED = "August 23, 2026";

const REPO_BLOB = "https://github.com/elmusleh/independent-youtube-playlist-manager/blob/main";

const FOOTER_LINKS = [
  { label: "Support & FAQ", href: `${REPO_BLOB}/docs/SUPPORT.md` },
  { label: "Release Notes", href: `${REPO_BLOB}/docs/RELEASE_NOTES.md` },
  {
    label: "Bug Reports",
    href: "https://github.com/elmusleh/independent-youtube-playlist-manager/issues",
  },
  { label: "Contributing", href: `${REPO_BLOB}/CONTRIBUTING.md` },
  { label: "Security Policy", href: `${REPO_BLOB}/SECURITY.md` },
  { label: "Privacy Policy", href: `${REPO_BLOB}/docs/PRIVACY_POLICY.md` },
  { label: "Terms of Service", href: `${REPO_BLOB}/docs/TERMS_OF_SERVICE.md` },
  { label: "Impressum", href: `${REPO_BLOB}/docs/IMPRESSUM.md` },
  { label: "License", href: `${REPO_BLOB}/LICENSE` },
];

export function Footer() {
  return (
    <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-200/70 bg-white/85 backdrop-blur-lg shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5"
        >
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] sm:text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="mt-2 flex flex-col sm:flex-row items-center justify-between gap-1 text-[10px] text-zinc-400">
          <p>© 2026 Independent YouTube Playlist Manager.</p>
          <p>Last updated: {LAST_UPDATED}</p>
        </div>
      </div>
    </footer>
  );
}
