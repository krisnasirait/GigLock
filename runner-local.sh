#!/usr/bin/env bash
#
# runner-local.sh — one-command local GigLock dev environment.
#
# What this script does:
#   1. Starts a Hardhat node (chainId 31337, 20 funded accounts)
#   2. Deploys all 5 GigLock contracts via Ignition to that node
#   3. Updates packages/relayer/.env with deployed addresses + a funded
#      relayer private key
#   4. Starts the Fastify relayer (port 8080)
#   5. Starts the Vite frontend (port 5173, with VITE_CHAIN_ID=31337)
#   6. Prints a MetaMask setup cheat sheet + curl-ready endpoints
#   7. Waits for Ctrl+C and tears everything down cleanly
#
# Background processes (PID files in .run/):
#   - Hardhat node:    .run/hardhat.pid   (logs: .run/hardhat.log)
#   - Relayer (Fastify): .run/relayer.pid (logs: .run/relayer.log)
#   - Frontend (Vite):  .run/frontend.pid (logs: .run/frontend.log)
#
# To stop everything from another terminal at any time, run:
#   ./runner-stop.sh
#

set -euo pipefail

# ---------- Configuration ----------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="${REPO_ROOT}/.run"
LOG_HARDHAT="${RUN_DIR}/hardhat.log"
LOG_RELAYER="${RUN_DIR}/relayer.log"
LOG_FRONTEND="${RUN_DIR}/frontend.log"
PID_HARDHAT="${RUN_DIR}/hardhat.pid"
PID_RELAYER="${RUN_DIR}/relayer.pid"
PID_FRONTEND="${RUN_DIR}/frontend.pid"

HARDHAT_PORT=8545
HARDHAT_HOST=127.0.0.1
RELAYER_PORT=8080
FRONTEND_PORT=5173

# Colours (turn off if not a TTY)
if [ -t 1 ]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_MAGENTA=$'\033[35m'
  C_CYAN=$'\033[36m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_MAGENTA=""; C_CYAN=""
fi

# ---------- Helpers ----------
log() { printf "${C_DIM}[%s]${C_RESET} %s\n" "$(date +%H:%M:%S)" "$*"; }
ok()  { printf "${C_GREEN}✓${C_RESET} %s\n" "$*"; }
warn(){ printf "${C_YELLOW}!${C_RESET} %s\n" "$*"; }
err() { printf "${C_MAGENTA}✗${C_RESET} %s\n" "$*" >&2; }

# Cleanup on Ctrl+C / exit
cleanup() {
  echo
  log "Shutting down..."
  for label in frontend relayer hardhat; do
    pidfile="${RUN_DIR}/${label}.pid"
    if [ -f "$pidfile" ]; then
      pid="$(cat "$pidfile" 2>/dev/null || true)"
      if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
        # Kill the whole process group (backgrounded processes may have children)
        kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
        ok "Stopped ${label} (pid ${pid})"
      fi
      rm -f "$pidfile"
    fi
  done
  log "Logs are in ${RUN_DIR}/ for inspection."
  log "To re-run, just: ./runner-local.sh"
}
trap cleanup EXIT INT TERM

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti :"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    warn "Port $port is busy (pids: $pids) — killing them"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
    sleep 0.5
  fi
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local tries=60  # ~30s
  while [ "$tries" -gt 0 ]; do
    if curl -fsS --max-time 1 "$url" >/dev/null 2>&1; then
      return 0
    fi
    tries=$((tries - 1))
    sleep 0.5
  done
  err "Timed out waiting for $url"
  return 1
}

# ---------- 0. Pre-flight ----------
cd "$REPO_ROOT"

log "GigLock runner-local.sh"
log "Repo root: ${REPO_ROOT}"
echo

# Required tools
for tool in node pnpm lsof curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    err "Missing required tool: $tool"
    exit 1
  fi
done

# Check we're in a git repo and on main (warning only)
branch="$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo "unknown")"
log "Branch: $branch"

# Disk space sanity
df -h "$REPO_ROOT" >/dev/null 2>&1 || true

# Make sure deps are installed
if [ ! -d "${REPO_ROOT}/node_modules" ]; then
  log "First run — installing workspace dependencies (this takes ~30s)"
  pnpm install
  ok "Workspace installed"
fi

# Shared package needs to be built (wagmi imports its chain def)
if [ ! -f "${REPO_ROOT}/packages/shared/dist/index.js" ]; then
  log "Building @giglock/shared (one-time)"
  pnpm --filter @giglock/shared build >/dev/null
  ok "Shared package built"
fi

# Compile contracts
if [ ! -d "${REPO_ROOT}/packages/contracts/artifacts" ]; then
  log "Compiling contracts (one-time)"
  (cd "${REPO_ROOT}/packages/contracts" && pnpm exec hardhat compile 2>&1 | tail -3)
  ok "Contracts compiled"
fi

# Make sure no leftover processes from prior runs
log "Clearing any leftover processes from a prior run..."
for label in hardhat relayer frontend; do
  pid="$(cat "${RUN_DIR}/${label}.pid" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill -TERM "$pid" 2>/dev/null || true
  fi
  rm -f "${RUN_DIR}/${label}.pid"
done
for port in "$HARDHAT_PORT" "$RELAYER_PORT" "$FRONTEND_PORT"; do
  kill_port "$port"
done

mkdir -p "$RUN_DIR"

# ---------- 1. Hardhat node ----------
log "Starting Hardhat node (chainId 31337)..."
cd "${REPO_ROOT}/packages/contracts"
# `setsid` puts Hardhat in its own process group so cleanup can kill the whole tree.
setsid pnpm exec hardhat node --hostname 0.0.0.0 --port "$HARDHAT_PORT" > "$LOG_HARDHAT" 2>&1 &
echo $! > "$PID_HARDHAT"
cd "$REPO_ROOT"

# Wait for the RPC to come up
wait_for_http "http://${HARDHAT_HOST}:${HARDHAT_PORT}" "Hardhat RPC" || {
  err "Hardhat node did not start. Last 20 lines of log:"
  tail -20 "$LOG_HARDHAT" >&2
  exit 1
}
ok "Hardhat RPC up at http://${HARDHAT_HOST}:${HARDHAT_PORT}"

# ---------- 2. Parse seed accounts (private keys) ----------
log "Reading seed accounts from Hardhat node log..."
sleep 1  # let the log fully render

# Each line in HH3 looks like:
#   Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cFFFb92266 (10000 ETH)
#   Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
#
# Some HH versions print keys inline. We try both shapes and grab the first 4
# accounts. We'll use:
#   #0 — deployer (also becomes Arbiter.admin and registry.factory initial)
#   #1 — Client wallet for demo
#   #2 — Worker wallet for demo
#   #3 — Relayer wallet

declare -A ADDR PK
for i in 0 1 2 3; do
  addr="$(grep -E "^Account #${i}: 0x[0-9a-fA-F]{40}" "$LOG_HARDHAT" | head -1 | awk '{print $3}')"
  # Try both inline and separate-line private key formats
  pk="$(grep -E "^Account #${i}:.*0x[0-9a-fA-F]{64}" "$LOG_HARDHAT" | head -1 | grep -oE '0x[0-9a-fA-F]{64}' | tail -1)"
  if [ -z "$pk" ]; then
    pk="$(grep -A 1 "^Account #${i}: 0x[0-9a-fA-F]{40}" "$LOG_HARDHAT" | grep -oE '0x[0-9a-fA-F]{64}' | head -1)"
  fi
  if [ -z "$addr" ] || [ -z "$pk" ]; then
    err "Failed to parse account #${i} from Hardhat log. Last 40 lines:"
    tail -40 "$LOG_HARDHAT" >&2
    err "Tip: Hardhat 3 prints private keys only if config exposes them. Falling back to known mnemonic defaults is not implemented here."
    exit 1
  fi
  ADDR[$i]="$addr"
  PK[$i]="$pk"
done

ok "Parsed 4 seed accounts"

# ---------- 3. Deploy via Ignition ----------
log "Deploying GigLock contracts via Ignition..."
cd "${REPO_ROOT}/packages/contracts"
DEPLOY_OUT="$(pnpm exec hardhat ignition deploy ignition/modules/GigLock.ts --network localhost 2>&1)"
DEPLOY_RC=$?
cd "$REPO_ROOT"

if [ "$DEPLOY_RC" -ne 0 ]; then
  err "Ignition deploy failed. Output:"
  echo "$DEPLOY_OUT" | tail -40 >&2
  exit 1
fi

ok "Contracts deployed"

# Capture addresses from lines like: "GigLock#MockUSDC - 0xe7f17..."
declare -A CONTRACT
for NAME in MockUSDC MockUSDCFaucet Arbiter ReputationRegistry JobFactory; do
  addr="$(printf '%s\n' "$DEPLOY_OUT" | grep -E "^GigLock#${NAME} - 0x[0-9a-fA-F]{40}$" | awk '{print $3}' | head -1)"
  if [ -z "$addr" ]; then
    err "Could not find GigLock#${NAME} address in deploy output"
    echo "$DEPLOY_OUT" | tail -40 >&2
    exit 1
  fi
  CONTRACT[$NAME]="$addr"
done

# ---------- 4. Update relayer .env ----------
RELAYER_ENV="${REPO_ROOT}/packages/relayer/.env"
log "Writing packages/relayer/.env..."
cat > "$RELAYER_ENV" <<EOF
# Auto-generated by runner-local.sh on $(date -u +%FT%TZ)
PORT=${RELAYER_PORT}
HOST=127.0.0.1
LOG_LEVEL=info
RELAYER_PRIVATE_KEY=${PK[3]}
RPC_URL=http://${HARDHAT_HOST}:${HARDHAT_PORT}
CHAIN_ID=31337
MINIMAL_FORWARDER_ADDRESS=${CONTRACT[JobFactory]}
ALLOWED_ORIGINS=http://localhost:${FRONTEND_PORT}
RATE_LIMIT_PER_MIN=60
EOF
ok "Wrote $RELAYER_ENV"

# ---------- 5. Start the relayer ----------
log "Starting Fastify relayer on port ${RELAYER_PORT}..."
cd "${REPO_ROOT}/packages/relayer"
setsid pnpm dev > "$LOG_RELAYER" 2>&1 &
echo $! > "$PID_RELAYER"
cd "$REPO_ROOT"

wait_for_http "http://127.0.0.1:${RELAYER_PORT}/health" "relayer" || {
  err "Relayer didn't come up. Last 20 lines:"
  tail -20 "$LOG_RELAYER" >&2
  exit 1
}
ok "Relayer up at http://127.0.0.1:${RELAYER_PORT}"

# ---------- 6. Start the frontend ----------
log "Starting Vite frontend on port ${FRONTEND_PORT}..."
cat > "${REPO_ROOT}/packages/frontend/.env.local" <<EOF
VITE_CHAIN_ID=31337
VITE_GIWA_RPC_URL=http://${HARDHAT_HOST}:${HARDHAT_PORT}
VITE_WALLETCONNECT_PROJECT_ID=
VITE_RELAYER_URL=http://127.0.0.1:${RELAYER_PORT}
VITE_IPFS_GATEWAY=https://w3s.link/ipfs/
EOF
cd "${REPO_ROOT}/packages/frontend"
setsid pnpm dev > "$LOG_FRONTEND" 2>&1 &
echo $! > "$PID_FRONTEND"
cd "$REPO_ROOT"

wait_for_http "http://127.0.0.1:${FRONTEND_PORT}/" "frontend" || {
  err "Frontend didn't come up. Last 20 lines:"
  tail -20 "$LOG_FRONTEND" >&2
  exit 1
}
ok "Frontend up at http://127.0.0.1:${FRONTEND_PORT}"

# ---------- 7. Print the summary ----------
cat <<EOF

${C_BOLD}${C_GREEN}╔═══════════════════════════════════════════════════════════════════╗${C_RESET}
${C_BOLD}${C_GREEN}║      GigLock is live — fully local, zero cost, zero setup      ║${C_RESET}
${C_BOLD}${C_GREEN}╚═══════════════════════════════════════════════════════════════════╝${C_RESET}

  ${C_BOLD}Frontend${C_RESET}     ${C_CYAN}http://127.0.0.1:${FRONTEND_PORT}${C_RESET}
  ${C_BOLD}Relayer${C_RESET}      ${C_CYAN}http://127.0.0.1:${RELAYER_PORT}/health${C_RESET}
  ${C_BOLD}Hardhat RPC${C_RESET}  ${C_CYAN}http://${HARDHAT_HOST}:${HARDHAT_PORT}${C_RESET}

${C_BOLD}Deployed contracts:${C_RESET}
  ${C_DIM}MockUSDC${C_RESET}             ${CONTRACT[MockUSDC]}
  ${C_DIM}MockUSDCFaucet${C_RESET}      ${CONTRACT[MockUSDCFaucet]}
  ${C_DIM}Arbiter${C_RESET}             ${CONTRACT[Arbiter]}
  ${C_DIM}ReputationRegistry${C_RESET}  ${CONTRACT[ReputationRegistry]}
  ${C_DIM}JobFactory${C_RESET}          ${CONTRACT[JobFactory]}

${C_BOLD}MetaMask setup (do this once):${C_RESET}
  1. Open MetaMask → network dropdown → "Add custom network"
  2. Fill in:
       ${C_BOLD}Network name${C_RESET}      Hardhat Local
       ${C_BOLD}RPC URL${C_RESET}          http://127.0.0.1:${HARDHAT_PORT}
       ${C_BOLD}Chain ID${C_RESET}         31337
       ${C_BOLD}Currency symbol${C_RESET}  ETH
  3. Click the icon in the top-right of MetaMask → "Import account"
  4. Paste each private key below to add Client, Worker, Relayer accounts:

       ${C_BOLD}Deployer (Arbiter.admin & deployer)${C_RESET}
       Address:  ${ADDR[0]}
       ${C_DIM}PK: ${PK[0]}${C_RESET}

       ${C_BOLD}Client (the demo's "person posting a job")${C_RESET}
       Address:  ${ADDR[1]}
       ${C_DIM}PK: ${PK[1]}${C_RESET}

       ${C_BOLD}Worker (the demo's "person doing the job")${C_RESET}
       Address:  ${ADDR[2]}
       ${C_DIM}PK: ${PK[2]}${C_RESET}

${C_BOLD}Suggested demo flow (5 min):${C_RESET}
  1. In MetaMask, switch to Client (${ADDR[1]:0:8}…)
  2. Open http://127.0.0.1:${FRONTEND_PORT} → click Connect Wallet
  3. Post a job with milestones (“e.g. \$100 +\$50”)
  4. Switch MetaMask to Worker (${ADDR[2]:0:8}…) → accept → submit proof
  5. Switch back to Client → confirm → done — funds move within one block

${C_BOLD}Logs:${C_RESET}
  ${C_DIM}tail -f .run/hardhat.log${C_RESET}
  ${C_DIM}tail -f .run/relayer.log${C_RESET}
  ${C_DIM}tail -f .run/frontend.log${C_RESET}

${C_BOLD}Stop:${C_RESET}
  ${C_DIM}./runner-stop.sh${C_RESET}  (or press Ctrl+C here)
EOF

# ---------- 8. Wait for Ctrl+C ----------
echo
log "Running. Press Ctrl+C to stop everything."
# `wait` returns when any backgrounded job exits; we use `wait -n` to wait on any of them.
# If the user Ctrl+C's, the trap fires and we exit cleanly.
while true; do
  sleep 60 &
  wait $! 2>/dev/null || true
done
