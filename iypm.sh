#!/usr/bin/env bash
# ==============================================================================
# iypm.sh — Independent YouTube Playlist Manager (IYPM) Control Center
# ==============================================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# ==============================================================================
# COMPLETION GENERATORS (called via --completion-*)
# ==============================================================================

# All commands and their descriptions for completion
COMMANDS=(
  "status:Project versions, store status, working tree"
  "features:Complete feature catalog"
  "changes:Version history & evolution"
  "dev:Overview of dev commands"
  "watch:Svelte SPA watch mode (HMR)"
  "web:Next.js portal dev server (localhost:3000)"
  "cors:CORS proxy for local API testing"
  "build:Full production build (Chrome + Firefox + Edge)"
  "pack:Create store packages (Chrome .zip + Firefox .zip + Edge .zip)"
  "pack:chrome:Chrome package only"
  "pack:firefox:Firefox package only"
  "pack:edge:Edge package only"
  "firefox:sign:Sign extension via AMO API (needs .env credentials)"
  "firefox:publish:Publish to AMO"
  "check:Full suite: lint → format → test → svelte-check"
  "lint:ESLint only"
  "lint:fix:ESLint auto-fix"
  "format:Prettier format all"
  "format:check:Prettier dry-run"
  "test:Unit tests (120 tests)"
  "test:watch:Watch mode for tests"
  "test:ext:Extension browser verification (90 viewport checks)"
  "test:portal:Portal E2E (Playwright)"
  "version:Show current version & sync status"
  "version:sync:Sync version across all manifests"
  "version:bump:Bump to new semver (e.g. 1.2.0)"
  "audit:npm audit"
  "clean:Remove dist/, node_modules/, package-lock.json"
  "reset:Clean + npm ci (full reinstall)"
  "features:Complete feature catalog"
  "changes:Version history & evolution"
  "help:Show this help"
)

generate_bash_completion() {
  cat <<'EOF'
# iypm.sh bash completion
_iypm_completions() {
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local prev="${COMP_WORDS[COMP_CWORD-1]}"
  local commands="status features changes dev watch web cors build pack pack:chrome pack:firefox pack:edge firefox:sign firefox:publish check lint lint:fix format format:check test test:watch test:ext test:portal version version:sync version:bump audit clean reset features changes help"

  # Handle subcommands that take arguments
  case "${prev}" in
    version:bump)
      COMPREPLY=($(compgen -W "1.2.0 1.1.2 2.0.0" -- "${cur}"))
      return 0
      ;;
  esac

  COMPREPLY=($(compgen -W "${commands}" -- "${cur}"))
  return 0
}

complete -F _iypm_completions ./iypm.sh
complete -F _iypm_completions iypm.sh
EOF
}

generate_zsh_completion() {
  cat <<'EOF'
# iypm.sh zsh completion
#compdef iypm.sh

_iypm() {
  local -a commands
  commands=(
    'status:Project versions, store status, working tree'
    'features:Complete feature catalog'
    'changes:Version history & evolution'
    'dev:Overview of dev commands'
    'watch:Svelte SPA watch mode (HMR)'
    'web:Next.js portal dev server (localhost:3000)'
    'cors:CORS proxy for local API testing'
    'build:Full production build (Chrome + Firefox + Edge)'
    'pack:Create store packages (Chrome .zip + Firefox .zip + Edge .zip)'
    'pack:chrome:Chrome package only'
    'pack:firefox:Firefox package only'
    'pack:edge:Edge package only'
    'firefox:sign:Sign extension via AMO API (needs .env credentials)'
    'firefox:publish:Publish to AMO'
    'check:Full suite: lint → format → test → svelte-check'
    'lint:ESLint only'
    'lint:fix:ESLint auto-fix'
    'format:Prettier format all'
    'format:check:Prettier dry-run'
    'test:Unit tests (120 tests)'
    'test:watch:Watch mode for tests'
    'test:ext:Extension browser verification (90 viewport checks)'
    'test:portal:Portal E2E (Playwright)'
    'version:Show current version & sync status'
    'version:sync:Sync version across all manifests'
    'version:bump:Bump to new semver (e.g. 1.2.0)'
    'audit:npm audit'
    'clean:Remove dist/, node_modules/, package-lock.json'
    'reset:Clean + npm ci (full reinstall)'
    'features:Complete feature catalog'
    'changes:Version history & evolution'
    'help:Show this help'
  )

  _describe 'command' commands
}

compdef _iypm iypm.sh
EOF
}

generate_fish_completion() {
  cat <<'EOF'
# iypm.sh fish completion

complete -c "./iypm.sh" -f -a "status" -d "Project versions, store status, working tree"
complete -c "./iypm.sh" -f -a "features" -d "Complete feature catalog"
complete -c "./iypm.sh" -f -a "changes" -d "Version history & evolution"
complete -c "./iypm.sh" -f -a "dev" -d "Overview of dev commands"
complete -c "./iypm.sh" -f -a "watch" -d "Svelte SPA watch mode (HMR)"
complete -c "./iypm.sh" -f -a "web" -d "Next.js portal dev server (localhost:3000)"
complete -c "./iypm.sh" -f -a "cors" -d "CORS proxy for local API testing"
complete -c "./iypm.sh" -f -a "build" -d "Full production build (Chrome + Firefox + Edge)"
complete -c "./iypm.sh" -f -a "pack" -d "Create store packages (Chrome .zip + Firefox .zip + Edge .zip)"
complete -c "./iypm.sh" -f -a "pack:chrome" -d "Chrome package only"
complete -c "./iypm.sh" -f -a "pack:firefox" -d "Firefox package only"
complete -c "./iypm.sh" -f -a "pack:edge" -d "Edge package only"
complete -c "./iypm.sh" -f -a "firefox:sign" -d "Sign extension via AMO API (needs .env credentials)"
complete -c "./iypm.sh" -f -a "firefox:publish" -d "Publish to AMO"
complete -c "./iypm.sh" -f -a "check" -d "Full suite: lint → format → test → svelte-check"
complete -c "./iypm.sh" -f -a "lint" -d "ESLint only"
complete -c "./iypm.sh" -f -a "lint:fix" -d "ESLint auto-fix"
complete -c "./iypm.sh" -f -a "format" -d "Prettier format all"
complete -c "./iypm.sh" -f -a "format:check" -d "Prettier dry-run"
complete -c "./iypm.sh" -f -a "test" -d "Unit tests (120 tests)"
complete -c "./iypm.sh" -f -a "test:watch" -d "Watch mode for tests"
complete -c "./iypm.sh" -f -a "test:ext" -d "Extension browser verification (90 viewport checks)"
complete -c "./iypm.sh" -f -a "test:portal" -d "Portal E2E (Playwright)"
complete -c "./iypm.sh" -f -a "version" -d "Show current version & sync status"
complete -c "./iypm.sh" -f -a "version:sync" -d "Sync version across all manifests"
complete -c "./iypm.sh" -f -a "version:bump" -d "Bump to new semver (e.g. 1.2.0)"
complete -c "./iypm.sh" -f -a "audit" -d "npm audit"
complete -c "./iypm.sh" -f -a "clean" -d "Remove dist/, node_modules/, package-lock.json"
complete -c "./iypm.sh" -f -a "reset" -d "Clean + npm ci (full reinstall)"
complete -c "./iypm.sh" -f -a "features" -d "Complete feature catalog"
complete -c "./iypm.sh" -f -a "changes" -d "Version history & evolution"
complete -c "./iypm.sh" -f -a "help" -d "Show this help"
EOF
}

# ==============================================================================
# COMPLETION FLAG HANDLING (must be before main script)
# ==============================================================================
case "${1:-}" in
  --completion-bash)
    generate_bash_completion
    exit 0
    ;;
  --completion-zsh)
    generate_zsh_completion
    exit 0
    ;;
  --completion-fish)
    generate_fish_completion
    exit 0
    ;;
esac

# ==============================================================================
# MAIN SCRIPT
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Colors
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_CYAN="\033[36m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_BLUE="\033[34m"
C_MAGENTA="\033[35m"
C_DIM="\033[2m"

# Helpers
print_header() {
  echo -e "${C_CYAN}${C_BOLD}"
  echo "╔════════════════════════════════════════════════════════════════════╗"
  echo "║     Independent YouTube Playlist Manager (IYPM) — CLI Hub         ║"
  echo "╚════════════════════════════════════════════════════════════════════╝"
  echo -e "${C_RESET}"
}

run_npm() {
  local cmd="$1"
  shift
  echo -e "${C_DIM}> npm run $cmd $*${C_RESET}"
  npm run "$cmd" "$@"
}

get_pkg_version() {
  node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown"
}

amo_query_python() {
  python3 - <<'PYEOF'
import os, json, time, hmac, hashlib, base64, urllib.request
env = {}
try:
    with open(".env") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.strip().split("=", 1)
                env[k.strip()] = v.strip('"\'')
    key = env.get("AMO_API_KEY")
    secret = env.get("AMO_API_SECRET", "").encode()
    if key and secret:
        now = int(time.time())
        payload = {"iss": key, "jti": os.urandom(16).hex(), "iat": now, "exp": now + 60}
        def b64url(d): return base64.urlsafe_b64encode(d).decode().rstrip("=")
        h_b64 = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        p_b64 = b64url(json.dumps(payload).encode())
        sig = b64url(hmac.new(secret, f"{h_b64}.{p_b64}".encode(), hashlib.sha256).digest())
        jwt = f"{h_b64}.{p_b64}.{sig}"
        url = "https://addons.mozilla.org/api/v5/addons/addon/independent-yt-playlist-manager%40elmusleh.github.io/versions/?page_size=2"
        req = urllib.request.Request(url, headers={"Authorization": f"JWT {jwt}"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            results = data.get("results", [])
            for r in results:
                v = r.get("version")
                ch = r.get("channel")
                st = r.get("file", {}).get("status")
                print(f"    - Firefox AMO ({ch}): v{v} -> \033[32m{st.upper()}\033[0m (ID {r.get('id')})")
except Exception as e:
    print("    - Firefox AMO: Could not query API (" + str(e) + ")")
PYEOF
}

# Help (defined early so case can call it)
cmd_help() {
  print_header
  echo -e "${C_BOLD}Usage:${C_RESET} ./iypm.sh [command] [args...]"
  echo ""
  echo -e "${C_BOLD}📋 Information:${C_RESET}"
  echo -e "  ${C_GREEN}status${C_RESET}          Project versions, store status, working tree"
  echo -e "  ${C_GREEN}features${C_RESET}        Complete feature catalog"
  echo -e "  ${C_GREEN}changes${C_RESET}         Version history & evolution"
  echo ""
  echo -e "${C_BOLD}🛠️ Development:${C_RESET}"
  echo -e "  ${C_GREEN}dev${C_RESET}             Overview of dev commands"
  echo -e "  ${C_GREEN}watch${C_RESET}           Svelte SPA watch mode (HMR)"
  echo -e "  ${C_GREEN}web${C_RESET}             Next.js portal dev server (localhost:3000)"
  echo -e "  ${C_GREEN}cors${C_RESET}            CORS proxy for local API testing"
  echo ""
  echo -e "${C_BOLD}🏗️ Build & Package:${C_RESET}"
  echo -e "  ${C_GREEN}build${C_RESET}           Full production build (Chrome + Firefox + Edge)"
  echo -e "  ${C_GREEN}pack${C_RESET}            Create store packages (Chrome .zip + Firefox .zip + Edge .zip)"
  echo -e "  ${C_GREEN}pack:chrome${C_RESET}     Chrome package only"
  echo -e "  ${C_GREEN}pack:firefox${C_RESET}    Firefox package only"
  echo -e "  ${C_GREEN}pack:edge${C_RESET}       Edge package only"
  echo ""
  echo -e "${C_BOLD}🦊 Firefox Release:${C_RESET}"
  echo -e "  ${C_GREEN}firefox:sign${C_RESET}    Sign extension via AMO API (needs .env credentials)"
  echo -e "  ${C_GREEN}firefox:publish${C_RESET} Publish to AMO"
  echo ""
  echo -e "${C_BOLD}✅ Quality & Testing:${C_RESET}"
  echo -e "  ${C_GREEN}check${C_RESET}           Full suite: lint → format → test → svelte-check"
  echo -e "  ${C_GREEN}lint${C_RESET}            ESLint only"
  echo -e "  ${C_GREEN}lint:fix${C_RESET}        ESLint auto-fix"
  echo -e "  ${C_GREEN}format${C_RESET}          Prettier format all"
  echo -e "  ${C_GREEN}format:check${C_RESET}    Prettier dry-run"
  echo -e "  ${C_GREEN}test${C_RESET}            Unit tests (120 tests)"
  echo -e "  ${C_GREEN}test:watch${C_RESET}      Watch mode for tests"
  echo -e "  ${C_GREEN}test:ext${C_RESET}        Extension browser verification (90 viewport checks)"
  echo -e "  ${C_GREEN}test:portal${C_RESET}     Portal E2E (Playwright)"
  echo ""
  echo -e "${C_BOLD}🔖 Version Management:${C_RESET}"
  echo -e "  ${C_GREEN}version${C_RESET}         Show current version & sync status"
  echo -e "  ${C_GREEN}version:sync${C_RESET}    Sync version across all manifests"
  echo -e "  ${C_GREEN}version:bump <ver>${C_RESET} Bump to new semver (e.g. 1.2.0)"
  echo ""
  echo -e "${C_BOLD}🔧 Maintenance:${C_RESET}"
  echo -e "  ${C_GREEN}audit${C_RESET}           npm audit"
  echo -e "  ${C_GREEN}clean${C_RESET}           Remove dist/, node_modules/, package-lock.json"
  echo -e "  ${C_GREEN}reset${C_RESET}           Clean + npm ci (full reinstall)"
  echo ""
  echo -e "${C_BOLD}Quick Start:${C_RESET}"
  echo -e "  ${C_CYAN}./iypm.sh check${C_RESET}      # Verify everything passes"
  echo -e "  ${C_CYAN}./iypm.sh build${C_RESET}      # Production build"
  echo -e "  ${C_CYAN}./iypm.sh pack${C_RESET}       # Store packages"
  echo -e "  ${C_CYAN}./iypm.sh status${C_RESET}     # Check store status"
  echo ""
  echo -e "${C_DIM}All commands proxy to npm run <script>. See package.json for full script list.${C_RESET}"
}

# Colors (moved down to avoid duplication with completion section)
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_CYAN="\033[36m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_BLUE="\033[34m"
C_MAGENTA="\033[35m"
C_DIM="\033[2m"

print_header() {
  echo -e "${C_CYAN}${C_BOLD}"
  echo "╔════════════════════════════════════════════════════════════════════╗"
  echo "║     Independent YouTube Playlist Manager (IYPM) — CLI Hub         ║"
  echo "╚════════════════════════════════════════════════════════════════════╝"
  echo -e "${C_RESET}"
}

run_npm() {
  local cmd="$1"
  shift
  echo -e "${C_DIM}> npm run $cmd $*${C_RESET}"
  npm run "$cmd" "$@"
}

get_pkg_version() {
  node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown"
}

amo_query_python() {
  python3 - <<'PYEOF'
import os, json, time, hmac, hashlib, base64, urllib.request
env = {}
try:
    with open(".env") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.strip().split("=", 1)
                env[k.strip()] = v.strip('"\'')
    key = env.get("AMO_API_KEY")
    secret = env.get("AMO_API_SECRET", "").encode()
    if key and secret:
        now = int(time.time())
        payload = {"iss": key, "jti": os.urandom(16).hex(), "iat": now, "exp": now + 60}
        def b64url(d): return base64.urlsafe_b64encode(d).decode().rstrip("=")
        h_b64 = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        p_b64 = b64url(json.dumps(payload).encode())
        sig = b64url(hmac.new(secret, f"{h_b64}.{p_b64}".encode(), hashlib.sha256).digest())
        jwt = f"{h_b64}.{p_b64}.{sig}"
        url = "https://addons.mozilla.org/api/v5/addons/addon/independent-yt-playlist-manager%40elmusleh.github.io/versions/?page_size=2"
        req = urllib.request.Request(url, headers={"Authorization": f"JWT {jwt}"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            results = data.get("results", [])
            for r in results:
                v = r.get("version")
                ch = r.get("channel")
                st = r.get("file", {}).get("status")
                print(f"    - Firefox AMO ({ch}): v{v} -> \033[32m{st.upper()}\033[0m (ID {r.get('id')})")
except Exception as e:
    print("    - Firefox AMO: Could not query API (" + str(e) + ")")
PYEOF
}

cmd_status() {
  print_header
  echo -e "${C_BOLD}📦 Project Versions & Environments:${C_RESET}"
  echo -e "  • package.json:              ${C_GREEN}$(get_pkg_version)${C_RESET}"
  echo -e "  • Target Gecko ID:           ${C_BLUE}independent-yt-playlist-manager@elmusleh.github.io${C_RESET}"
  echo -e "  • Chrome Extension ID:       ${C_BLUE}dapjjdcnolpmfcnobilphjfpkmmokgid${C_RESET}"
  echo -e "  • Edge Add-ons:              ${C_YELLOW}v1.1.1 package ready; submission pending${C_RESET}"
  echo -e "  • Official Web Portal:       ${C_CYAN}https://iypm.vercel.app/${C_RESET}"
  echo ""

  echo -e "${C_BOLD}🏪 Store Status:${C_RESET}"
  if [ -f ".env" ] && grep -q "AMO_API_KEY" .env; then
    echo -e "  • Querying AMO API..."
    amo_query_python 2>/dev/null || echo -e "  • Firefox AMO: Check dashboard at https://addons.mozilla.org/en-US/developers/addon/iypm"
  else
    echo -e "  • Firefox AMO: No credentials in .env to query status"
  fi
  echo -e "  • Chrome Web Store: v1.1.1 (Pending review / auto-publish on approval)"
  echo ""

  echo -e "${C_BOLD}🧪 Unlisted Firefox Test Release:${C_RESET}"
  local XPI_FILE="dist/firefox/web-ext-artifacts/independent_youtube_playlist_manager-1.2.0.1.xpi"
  if [ -f "$XPI_FILE" ]; then
    local XPI_SIZE
    XPI_SIZE="$(du -h "$XPI_FILE" | cut -f1)"
    echo -e "  • Local signed .xpi:         ${C_GREEN}$XPI_FILE ($XPI_SIZE)${C_RESET}"
    echo -e "  • Mozilla signed:            ${C_GREEN}YES (META-INF attached)${C_RESET}"
    echo -e "  • Install instructions:      Drag & drop into Firefox to install without developer mode."
  else
    echo -e "  • Local signed .xpi:         ${C_YELLOW}None built yet. Run ./iypm.sh test-release${C_RESET}"
  fi
  echo ""

  echo -e "${C_BOLD}🔍 Working Tree Status:${C_RESET}"
  local DIRTY
  DIRTY="$(git status --porcelain)"
  if [ -z "$DIRTY" ]; then
    echo -e "  • Clean working tree:        ${C_GREEN}Everything committed.${C_RESET}"
  else
    echo -e "  • Modified / unstaged:       ${C_YELLOW}$(echo "$DIRTY" | wc -l) file(s) modified.${C_RESET}"
  fi
}

# Development commands
cmd_dev() {
  print_header
  echo -e "${C_BOLD}🚀 Development Servers:${C_RESET}"
  echo ""
  echo -e "  ${C_GREEN}./iypm.sh watch${C_RESET}        Watch mode for Svelte SPA (HMR)"
  echo -e "  ${C_GREEN}./iypm.sh web${C_RESET}          Next.js dev server (localhost:3000)"
  echo -e "  ${C_GREEN}./iypm.sh cors${C_RESET}         CORS proxy for local API testing"
  echo ""
  echo -e "${C_BOLD}Usage Examples:${C_RESET}"
  echo -e "  ${C_CYAN}./iypm.sh watch${C_RESET}         # Terminal 1: SPA live reload"
  echo -e "  ${C_CYAN}./iypm.sh web${C_RESET}           # Terminal 2: Portal at :3000"
  echo -e "  ${C_CYAN}./iypm.sh cors${C_RESET}          # Terminal 3: CORS proxy for API"
}

cmd_watch() { run_npm watch; }
cmd_web() { run_npm web; }
cmd_cors() { run_npm cors; }

# Build & Package commands
cmd_build() { run_npm build; }

cmd_package() {
  print_header
  echo -e "${C_BOLD}📦 Package Extensions for Store Submission:${C_RESET}"
  echo ""
  echo -e "  ${C_GREEN}./iypm.sh pack${C_RESET}          Create Chrome (.zip) + Firefox (.zip) + Edge (.zip)"
  echo -e "  ${C_GREEN}./iypm.sh pack:chrome${C_RESET}   Create Chrome Web Store package only"
  echo -e "  ${C_GREEN}./iypm.sh pack:firefox${C_RESET}  Create Firefox AMO package only"
  echo -e "  ${C_GREEN}./iypm.sh pack:edge${C_RESET}     Create Microsoft Edge Addons package only"
  echo ""
  run_npm pack
}

cmd_pack_chrome() { run_npm "pack:chrome"; }
cmd_pack_firefox() { run_npm "pack:firefox"; }
cmd_pack_edge() { run_npm "pack:edge"; }

# Firefox Release commands
cmd_firefox_sign() {
  print_header
  echo -e "${C_BOLD}🦊 Sign Firefox Extension (requires .env with AMO_API_KEY/SECRET):${C_RESET}"
  run_npm "sign-firefox"
}

cmd_firefox_publish() {
  print_header
  echo -e "${C_BOLD}🚀 Publish Firefox Extension to AMO:${C_RESET}"
  run_npm "publish:firefox"
}

# Testing & Quality
cmd_check() { run_npm check; }
cmd_lint() { run_npm lint; }
cmd_lint_fix() { run_npm "lint:fix"; }
cmd_format() { run_npm format; }
cmd_format_check() { run_npm "format:check"; }

cmd_test() {
  print_header
  echo -e "${C_BOLD}🧪 Test Suite:${C_RESET}"
  echo ""
  echo -e "  ${C_GREEN}./iypm.sh test${C_RESET}          Run all unit tests (Vitest)"
  echo -e "  ${C_GREEN}./iypm.sh test:watch${C_RESET}    Watch mode for tests"
  echo -e "  ${C_GREEN}./iypm.sh test:ext${C_RESET}      Extension browser verification (90 checks)"
  echo -e "  ${C_GREEN}./iypm.sh test:portal${C_RESET}   Portal E2E tests (Playwright)"
  echo ""
  run_npm test
}

cmd_test_watch() { run_npm "test:watch"; }
cmd_test_ext() { run_npm "test:extension"; }
cmd_test_portal() { run_npm "test:portal"; }

# Version management
cmd_version() {
  print_header
  echo -e "${C_BOLD}🔖 Version Management:${C_RESET}"
  echo ""
  echo -e "  ${C_GREEN}./iypm.sh version:bump <ver>${C_RESET}  Bump version (e.g. 1.2.0)"
  echo -e "  ${C_GREEN}./iypm.sh version:sync${C_RESET}        Sync version across all manifests"
  echo ""
  echo -e "  Current: ${C_GREEN}$(get_pkg_version)${C_RESET}"
}

cmd_version_sync() { run_npm "sync-version"; }
cmd_version_bump() {
  if [ -z "${2:-}" ]; then
    echo -e "${C_RED}Usage: ./iypm.sh version:bump <semver>${C_RESET}"
    exit 1
  fi
  run_npm "sync-version" --set "$2"
}

# Quality & Audit
cmd_audit() { run_npm audit; }

# Clean & Reset
cmd_clean() {
  print_header
  echo -e "${C_BOLD}🧹 Clean Build Artifacts:${C_RESET}"
  echo -e "  Removing ${C_YELLOW}dist/${C_RESET}, ${C_YELLOW}node_modules/${C_RESET}..."
  rm -rf dist node_modules
  # package-lock.json is tracked. Deleting it would also break `npm ci`, which
  # requires an existing lockfile, so removing it is opt-in and pairs with npm install.
  if [[ "${1:-}" == "--with-lock" ]]; then
    echo -e "  ${C_YELLOW}Also removing package-lock.json${C_RESET} (tracked; reinstall with ${C_CYAN}npm install${C_RESET}, not npm ci)"
    rm -f package-lock.json
  fi
  echo -e "  ${C_GREEN}Done.${C_RESET} Run ${C_CYAN}npm ci${C_RESET} to reinstall."
}

cmd_reset() {
  cmd_clean
  print_header
  echo -e "  ${C_BOLD}Reinstalling dependencies from the lockfile...${C_RESET}"
  npm ci
}

# Documentation & Meta
cmd_features() {
  print_header
  echo -e "${C_BOLD}✨ Complete IYPM Feature Catalog & Capabilities:${C_RESET}\n"

  echo -e "${C_MAGENTA}${C_BOLD}1. Independent Playlist Creation & Local Storage${C_RESET}"
  echo "   • Local-first: Create & organize playlists with zero Google account login required."
  echo "   • Multi-Gigabyte storage: High-frequency metadata stored in IndexedDB (yph_metadata_db_v2)."
  echo "   • Debounced auto-save & schema normalization on all playlist operations."
  echo ""

  echo -e "${C_MAGENTA}${C_BOLD}2. Multi-Tier Zero-Quota Video Metadata Scraping${C_RESET}"
  echo "   • Tier 1 (Innertube): Direct player API query with MWEB & TVHTML5 profiles."
  echo "   • Tier 2 (Embed page): Extracts initial player JSON directly from embed HTML."
  echo "   • Tier 3 (oEmbed): Zero-quota fallback for video title and channel name."
  echo "   • Tier 4 (YouTube Data API v3): Batch queries when user provides custom OAuth / API key."
  echo "   • Tier 5 (Invidious / Piped): Decentralized open fallback instances."
  echo ""

  echo -e "${C_MAGENTA}${C_BOLD}3. Watch History & Local Progress Tracking${C_RESET}"
  echo "   • Automatic tracking: Tracks video watch timestamp & progress percentages."
  echo "   • Configurable rules: Auto-delete from playlist when completion threshold reached."
  echo "   • Save on pause, save on page unload, throttle/debounce settings."
  echo ""

  echo -e "${C_MAGENTA}${C_BOLD}4. Quick-Add Toolbar Popup & Tab Scraper${C_RESET}"
  echo "   • Quick add: 1-click add active video or open YouTube tabs into selected playlist."
  echo "   • Shortcuts: Alt+Shift+Y (open popup), Alt+Shift+A (quick add active video)."
  echo "   • Scrape open tabs across current window or all windows."
  echo "   • Target modes: Favorite playlist, last edited playlist, or choose from dropdown."
  echo ""

  echo -e "${C_MAGENTA}${C_BOLD}5. Cloud Sync & Backup System${C_RESET}"
  echo "   • Full Portable Backup: Export/import complete database as JSON schema v2."
  echo "   • Optional Supabase Sync: Bidirectional delta-sync with Last-Write-Wins (LWW)."
  echo "   • Deduplicated global video catalog."
  echo ""

  echo -e "${C_MAGENTA}${C_BOLD}6. Responsive UI & Accessibility (WCAG AA)${C_RESET}"
  echo "   • Multi-breakpoint support: 320px (small phones) up to 1440px+ (ultrawide)."
  echo "   • Touch target compliance: 44×44px minimum for all interactive elements."
  echo "   • Dark & Light theme with automatic system preference detection."
  echo "   • High contrast mode and reduced motion support."
}

cmd_changes() {
  print_header
  echo -e "${C_BOLD}📋 Recent Version Changelog & Evolution:${C_RESET}\n"

  echo -e "${C_CYAN}${C_BOLD}● Unreleased (Microsoft Edge Support)${C_RESET}"
  echo "   • Edge (Chromium) build derived from the Chrome manifest minus key/browser-specific fields."
  echo "   • Edge Add-ons packaging and manifest validation."
  echo "   • Portal Edge install button gated until the store listing is approved."
  echo ""

  echo -e "${C_CYAN}${C_BOLD}● v1.2.0.1 (Current Unlisted Test Release)${C_RESET}"
  echo "   • First signed Firefox unlisted beta distribution."
  echo "   • Fixed Settings view styles: moved settings.css to global bundling in main.ts."
  echo "   • Automated CSS quality gate (verify-css-bundle.js) enforcing no mid-bundle @imports."
  echo ""

  echo -e "${C_CYAN}${C_BOLD}● v1.1.1 (Store Release — Submitted & Approved)${C_RESET}"
  echo "   • Corrected Firefox data collection declarations (browsingActivity, websiteContent)."
  echo "   • Added user consent guards for optional Google/Supabase authentication and search."
  echo "   • Expanded unit test suite to 120 tests with 100% pass rate."
  echo "   • Removed obsolete Chrome bookmarks permission."
  echo ""

  echo -e "${C_CYAN}${C_BOLD}● v1.1.0 (Responsive UX & Hardening)${C_RESET}"
  echo "   • Adaptive popup & dialog layouts for viewports 320px–1000px."
  echo "   • Focus trap and scroll-lock for all modal dialogs."
  echo "   • Touch-friendly reordering controls & keyboard accessibility."
  echo "   • Mobile YouTube (m.youtube.com) support."
  echo "   • Backup schema validation rejecting malformed/future formats."
  echo ""

  echo -e "${C_CYAN}${C_BOLD}● v1.0.1 (Initial Stable Store Release)${C_RESET}"
  echo "   • Core independent playlist management with IndexedDB caching."
  echo "   • Chrome MV3 and Firefox MV3 compatibility."
  echo "   • Multi-tier Innertube zero-quota metadata extraction."
}

# Main routing
case "${1:-help}" in
  # Info & Status
  status)
    cmd_status
    ;;

  # Development
  dev)
    cmd_dev
    ;;
  watch)
    cmd_watch
    ;;
  web)
    cmd_web
    ;;
  cors)
    cmd_cors
    ;;

  # Build & Package
  build)
    cmd_build
    ;;
  pack|package)
    cmd_package
    ;;
  "pack:chrome")
    cmd_pack_chrome
    ;;
  "pack:firefox")
    cmd_pack_firefox
    ;;
  "pack:edge")
    cmd_pack_edge
    ;;

  # Firefox Release
  "firefox:sign"|sign-firefox)
    cmd_firefox_sign
    ;;
  "firefox:publish"|publish-firefox)
    cmd_firefox_publish
    ;;

  # Quality & Testing
  check|verify|test)
    cmd_check
    ;;
  lint)
    cmd_lint
    ;;
  "lint:fix")
    cmd_lint_fix
    ;;
  format)
    cmd_format
    ;;
  "format:check")
    cmd_format_check
    ;;
  test)
    cmd_test
    ;;
  "test:watch")
    cmd_test_watch
    ;;
  "test:ext"|"test:extension")
    cmd_test_ext
    ;;
  "test:portal")
    cmd_test_portal
    ;;

  # Version
  version)
    cmd_version
    ;;
  "version:sync")
    cmd_version_sync
    ;;
  "version:bump")
    cmd_version_bump "$@"
    ;;

  # Quality
  audit)
    cmd_audit
    ;;

  # Clean & Reset
  clean)
    cmd_clean "${2:-}"
    ;;
  reset)
    cmd_reset
    ;;

  # Docs
  features|feat)
    cmd_features
    ;;
  changes|changelog|history)
    cmd_changes
    ;;

  # Help
  help|--help|-h)
    cmd_help
    ;;

  *)
    echo -e "${C_RED}Unknown command: $1${C_RESET}\n"
    cmd_help
    exit 1
    ;;
esac