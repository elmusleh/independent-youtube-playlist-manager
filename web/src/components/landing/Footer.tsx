import React from "react";

const LAST_UPDATED = "August 23, 2026";

const REPO_BLOB = "https://github.com/el-musleh/independent-youtube-playlist-manager/blob/master";

const FOOTER_LINKS = [
  { label: "Support & FAQ", href: `${REPO_BLOB}/docs/SUPPORT.md` },
  { label: "Release Notes", href: `${REPO_BLOB}/docs/RELEASE_NOTES.md` },
  { label: "Bug Reports", href: "https://github.com/el-musleh/independent-youtube-playlist-manager/issues" },
  { label: "Contributing", href: `${REPO_BLOB}/CONTRIBUTING.md` },
  { label: "Security Policy", href: `${REPO_BLOB}/SECURITY.md` },
  { label: "Privacy Policy", href: `${REPO_BLOB}/docs/PRIVACY_POLICY.md` },
  { label: "Terms of Service", href: `${REPO_BLOB}/docs/TERMS_OF_SERVICE.md` },
  { label: "Impressum", href: `${REPO_BLOB}/docs/IMPRESSUM.md` },
  { label: "License", href: `${REPO_BLOB}/LICENSE` },
];

export function Footer() {
  return (
    <footer className="border-t border-zinc-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
        >
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="mt-6 pt-6 border-t border-zinc-200/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-400">
          <p>© 2026 Independent YouTube Playlist Manager. Not affiliated with YouTube™ or Google LLC.</p>
          <p>Last updated: {LAST_UPDATED}</p>
        </div>
      </div>
    </footer>
  );
}
