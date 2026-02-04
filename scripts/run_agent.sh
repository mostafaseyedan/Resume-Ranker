#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="$ROOT_DIR/backend/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

export USE_BROWSERBASE="${USE_BROWSERBASE:-false}"
export AGENT_PORT="${AGENT_PORT:-9777}"
export AGENT_HEADLESS="${AGENT_HEADLESS:-false}"

"$PYTHON_BIN" "$ROOT_DIR/backend/agent/agent_app.py"
