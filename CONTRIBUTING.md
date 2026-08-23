# Contributing to Independent YouTube Playlist Manager

Thank you for your interest in contributing! This project is maintained primarily by AI agents, but human contributions are welcome and appreciated.

## Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

## Project Structure

The repository has three layers:

- **`apps/browser-extension/apps/browser-extension/playlist-editor/`** — Svelte 5 + TypeScript SPA that compiles into `apps/browser-extension/editor/`. All extension UI lives here.
- **`apps/browser-extension/`** — Plain JS WebExtension shell (background service worker, popup, content scripts) plus the compiled editor output.
- **`apps/web-portal/`** — Next.js 15 marketing site and dashboard (`npm run web` / `npm run web:build`).

## Local Development Setup

```bash
# 1. Clone with submodules
git clone --recurse-submodules https://github.com/el-musleh/independent-youtube-playlist-manager.git
cd independent-youtube-playlist-manager

# 2. Install dependencies
npm install
cd apps/browser-extension/playlist-editor && npm install && cd ..
cd web && npm install && cd ..
```

## Build & Verify

All commands run from the repository root:

```bash
# Type-check the Svelte SPA
cd apps/browser-extension/playlist-editor && npx svelte-check && cd ..

# Full production build (extension + dist/)
npm run build

# Web portal build
npm run web:build

# Watch mode for development
npm run watch
```

## Coding Standards

- **TypeScript** for the SPA; **plain JS** for the extension shell.
- Follow existing file conventions and naming.
- Metadata writes must go through `db-service.ts` (IndexedDB), never `browser.storage.local` (see `docs/AGENTS.md` storage rules).
- Run `npm run build` and `svelte-check` before submitting — CI enforces both.
- Keep manifests clean: never add `apps/browser-extension/manifest.json`; only `manifest.chrome.json` and `manifest.firefox.json` exist.

## Pull Request Guidelines

1. Fork the repository and create a branch from `master`.
2. Make focused, minimal changes — one concern per PR.
3. Update documentation (`README.md`, `docs/RELEASE_NOTES.md`, relevant `.md`) when behavior changes.
4. Ensure `npm run build`, `svelte-check`, and `npm run web:build` all pass.
5. Write a clear PR description: what, why, and how to test.
6. Commit messages should follow the conventional format: `type(scope): description`.

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(editor): add bulk reorder
fix(sync): resolve quota resume race
docs(readme): update build instructions
```

## Reporting Issues

See the [Support & FAQ](docs/SUPPORT.md) for bug-report guidelines. For **security vulnerabilities**, do not open a public issue — see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
