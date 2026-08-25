import React from "react";

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
    <footer className="border-t border-zinc-200/70 bg-white/85 backdrop-blur-lg shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
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

        <p className="mt-1.5 text-center text-[10px] text-zinc-400">
          © 2026 Independent YouTube Playlist Manager.
        </p>
      </div>
    </footer>
  );
}
