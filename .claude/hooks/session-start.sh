#!/bin/bash
# Installs the google-seo-mcp server so the MCP entry in .mcp.json can connect.
# Remote (Claude Code on the web) only -- local machines manage their own tooling.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PKG="google-seo-mcp"
SPEC="git+https://github.com/mario-hernandez/google-seo-mcp-claude-code"
BIN_DIR="${PIPX_BIN_DIR:-$HOME/.local/bin}"

# pipx is not part of the base image.
if ! python3 -m pipx --version >/dev/null 2>&1; then
  python3 -m pip install --user --quiet pipx
fi

# pipx's default uv backend can be older than pipx requires; the pip backend
# has no such version coupling.
if [ ! -x "$BIN_DIR/$PKG" ]; then
  python3 -m pipx install --backend pip "$SPEC"
fi

# The package declares `mcp>=1.2.0` with no upper bound, so a fresh resolve
# picks up mcp 2.x, which dropped the `mcp.server.fastmcp` module the server
# imports at startup. Pin back to 1.x when the import is missing.
VENVS="$(python3 -m pipx environment --value PIPX_LOCAL_VENVS)"
VENV_PY="$VENVS/$PKG/bin/python"
if [ -x "$VENV_PY" ] && ! "$VENV_PY" -c "import mcp.server.fastmcp" >/dev/null 2>&1; then
  python3 -m pipx runpip "$PKG" install --quiet 'mcp<2'
fi

# pipx installs land here; keep them reachable for the session.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$CLAUDE_ENV_FILE" ;;
  esac
fi

# Import check rather than a launch -- the entry point is a stdio server and
# would block waiting on a client.
"$VENV_PY" -c "import google_seo_mcp.server"

# Register at user scope. A project-scope .mcp.json would need the trust
# prompt answered interactively, which never happens in a web session.
if command -v claude >/dev/null 2>&1; then
  if ! claude mcp get "$PKG" >/dev/null 2>&1; then
    claude mcp add --scope user "$PKG" -- "$BIN_DIR/$PKG"
  fi
fi

echo "$PKG ready: $BIN_DIR/$PKG"
