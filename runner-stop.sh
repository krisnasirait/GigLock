#!/usr/bin/env bash
#
# runner-stop.sh — emergency-stop everything started by runner-local.sh.
#
#   ./runner-stop.sh [repo-root]
#
# If you don't pass a repo-root, the script looks for a sibling `.run/`
# directory next to itself. Kills any process whose PID is recorded under
# `.run/*.pid` AND any processes listening on the standard dev ports
# (8545, 8080, 5173).

set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
RUN_DIR="${REPO_ROOT}/.run"

echo "[runner-stop] Repo root: ${REPO_ROOT}"

# Kill PID-file tracked processes first (graceful TERM, then KILL)
for label in frontend relayer hardhat; do
  pidfile="${RUN_DIR}/${label}.pid"
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      # Try the process group first (setsid'd processes live in their own pgrp).
      kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
      sleep 0.5
      if kill -0 "$pid" 2>/dev/null; then
        kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
      fi
      echo "[runner-stop] Stopped ${label} (pid ${pid})"
    fi
    rm -f "$pidfile"
  fi
done

# Sweep any leftover dev-server processes on the standard ports (Hardhat/Relayer/Frontend).
for port in 8545 8080 5173; do
  pids="$(lsof -ti :"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
    echo "[runner-stop] Cleaned up leftover listeners on :$port"
  fi
done

echo "[runner-stop] Done. To re-run: ./runner-local.sh"
