#!/usr/bin/env bash
# ==============================================================================
# iypm.sh completion — Bash/Zsh tab completion for iypm.sh
# ==============================================================================
# Install:
#   bash:  source <(./iypm.sh --completion-bash)   # or add to ~/.bashrc
#   zsh:   source <(./iypm.sh --completion-zsh)   # or add to ~/.zshrc
#   fish:  ./iypm.sh --completion-fish | source   # or add to ~/.config/fish/config.fish
# ==============================================================================

# This file is meant to be SOURCED, not executed.
# The iypm.sh script will generate the appropriate completion when called with
# --completion-bash, --completion-zsh, or --completion-fish.

# If you want a static completion file, run:
#   ./iypm.sh --completion-bash > /usr/local/share/bash-completion/completions/iypm
#   ./iypm.sh --completion-zsh  > /usr/local/share/zsh/site-functions/_iypm
#   ./iypm.sh --completion-fish > ~/.config/fish/completions/iypm.fish

# But the preferred approach is to have iypm.sh generate it dynamically so it
# always stays in sync with the script's actual commands.

return 0 2>/dev/null || exit 0