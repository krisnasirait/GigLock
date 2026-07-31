# GigLock

**Instant pay and portable reputation for gig workers, built on GIWA Chain.**

[![contracts](https://img.shields.io/badge/contracts-19%20passing-brightgreen)](packages/contracts) [![relayer](https://img.shields.io/badge/relayer-5%20passing-brightgreen)](packages/relayer) [![frontend](https://img.shields.io/badge/frontend-landing%20live-blue)](packages/frontend) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A trust layer for the gig economy: smart-contract escrow that pays workers the **same block** a milestone is confirmed, with reputation that's **portable** across any client app because it lives on a public contract keyed to wallet identity (and gated by GIWA's Dojang Verified Address).

```
Client funds escrow → Worker accepts + submits proof → Client confirms → Funds land in worker's wallet (within one block on Hardhat local, ~1s on GIWA Sepolia thanks to 1-second block time).
```

---

## What's in the box

GigLock ships as a **pnpm monorepo** with four packages:

| Package | What it does | Status |
|---|---|---|
| **`packages/contracts`** | `JobFactory`, `EscrowJob` (full state machine), `ReputationRegistry` (with Dojang identity gate), `Arbiter`, `MockUSDC` + faucet, Ignition deploy module, Hardhat 3 + viem toolbox | 19 unit tests passing |
| **`packages/shared`** | Typed ABIs (auto-generated from contracts), GIWA chain defs, EIP-712 typed-data builders, `pickChain()` helper, `addresses.ts` registry | builds + emits ABIs |
| **`packages/frontend`** | Vite + React 18 + wagmi v2 + RainbowKit + Tailwind. Landing page live; routes for dashboard/post-job/job-detail are stubbed. | builds clean; landing live at `localhost:5173` |
| **`packages/relayer`** | Fastify v5 service. `GET /health` live; `POST /ipfs/pin` (Filebase-backed) live; `/meta-tx` route (EIP-2771 minimal forwarder) is the next plan. | 5 unit tests passing |

---

## Quickstart

You have two ways to run GigLock locally. Use the runner script — it's faster.

### One-command local dev (recommended)

```bash
./runner-local.sh
```

This boots:
- Local Hardhat node (chainId `31337`, 20 funded accounts)
- All 5 contracts deployed via Ignition
- Relayer on `http://localhost:8080`
- Frontend on `http://localhost:5173`

It prints a MetaMask setup cheat sheet with the 4 funded private keys when it finishes. Ctrl+C stops everything cleanly.

```bash
./runner-stop.sh    # emergency-stop from another terminal
```

### Manual local dev (4 terminals)

```bash
nvm use                              # Node 22 LTS
pnpm install
pnpm --filter @giglock/shared build  # one-time: build shared so ABIs exist

# Terminal 1
cd packages/contracts && pnpm exec hardhat node

# Terminal 2
cd packages/contracts && pnpm exec hardhat ignition deploy ignition/modules/GigLock.ts --network hardhat

# Terminal 3
cd packages/relayer && cp .env.example .env   # fill in REPAYER_PRIVATE_KEY etc.
pnpm dev

# Terminal 4
cd packages/frontend && cp .env.example .env.local
pnpm dev
```

Vite serves on `http://localhost:5173`. The relayer's `/health` returns `{ok: true}` at `http://localhost:8080/health`.

---

## Run the tests

```bash
pnpm test                    # all packages
pnpm --filter @giglock/contracts test   # 19 contract tests
pnpm --filter @giglock/relayer test    # 5 route tests
```

CI on every PR runs these jobs (`.github/workflows/ci.yml`):
- `lint-and-typecheck` — `tsc --noEmit` across all 4 packages
- `test-contracts` — `hardhat test` (EscrowJob, ReputationRegistry, JobFactory, Arbiter, MockUSDC)
- `test-relayer` — `vitest run` (Fastify inject-based route tests)
- `build` — full workspace build

---

## Deploy to GIWA Sepolia + Vercel + Render

Full step-by-step in [`docs/DEPLOY.md`](docs/DEPLOY.md):

| Surface | Recommended host | Cost |
|---|---|---|
| **Smart contracts** | GIWA Sepolia (Ignition module is at `packages/contracts/ignition/modules/GigLock.ts`) | ~0.005 Sepolia ETH (faucet: <https://faucet.giwa.io/>) |
| **Frontend** | **Vercel** — monorepo-aware build via `packages/frontend/vercel.json` | Free tier covers the MVP |
| **Relayer** | **Render** — one-click Blueprint via `packages/relayer/render.yaml` (Dockerfile included) | Free tier covers the MVP |
| **IPFS pinning** | **Filebase** (S3-compatible) — relayer's `/ipfs/pin` endpoint pins uploads automatically; credentials stay on the backend | Free tier covers the MVP |

The deployment doc walks through:
1. Wallet setup (deployer, relayer — never reuse your main wallet)
2. Funding deployer with Sepolia ETH
3. Ignition deploy + Blockscout verification
4. Vercel project import + env vars
5. Render Blueprint + secret env vars
6. Filebase bucket + API key setup
7. End-to-end demo script (5 minutes)
8. Security checklist for testnet + pre-mainnet
9. Operations + monitoring + cost estimates

---

## End-to-end demo (5 minutes)

The full hackathon-pitch-worthy script is in §8 of [`docs/DEPLOY.md`](docs/DEPLOY.md). Quick version:

1. **Post a job** as Client (e.g. "Deliver prototype", $100 + $50 milestones)
2. **Worker accepts** (zero ETH on worker = relayer sponsoring gas — coming in `/meta-tx` plan)
3. **Worker submits proof** (photo → IPFS via Filebase → keccak256 on-chain)
4. **Client confirms** → funds land in worker wallet within one block
5. **Optional timeout**: after 48h, anyone can `claimTimeout()` and funds auto-release

The same flow works against local Hardhat (instant), GIWA Sepolia (~1s blocks), or mainnet (post-audit).

---

## Architecture (one diagram worth a thousand words)

```
                                  ┌──────────────────┐
                                  │   Vercel CDN     │
                                  │   (Vite SPA)     │
                                  └────────▲─────────┘
                                           │
                                  ┌────────┴─────────┐
                                  │  WalletConnect / │
                                  │  MetaMask        │
                                  └────────▲─────────┘
                                           │
                                            ┌─────────────────────┐
                                            │ Render (Fastify)     │
              EIP-712 meta-tx    ───POST───▶│ /health  (live)     │
              (signed by worker)              │ /ipfs/pin (live)    │
                                            │ /meta-tx   (next)   │
                                            └────────────┬────────┘
                                                         │
                                          ┌──────────────▼──────────────┐
                                          │  GIWA Chain (Sepolia / mainnet) │
                                          │                                │
                                          │  JobFactory                     │
                                          │   └─ EscrowJob (×N)             │
                                          │  ReputationRegistry             │
                                          │   └─ DojangScroll (identity)    │
                                          │  Arbiter                         │
                                          │  MockUSDC + Faucet               │
                                          │  [MinimalForwarder — next]      │
                                          └─────────────────────────────────┘
```

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Package manager | **pnpm 9** workspaces | Fast, deterministic, supports `workspace:*` deps |
| Smart contracts | **Solidity 0.8.24** + **Hardhat 3** + **viem toolbox** + **OpenZep Contracts 5.x** | Modern ESM-friendly toolchain; OZ for ERC20 + ReentrancyGuard + minimal forwarder |
| ID system | **Dojang Verified Address** (EAS attestation) — `0xd5077b67...17B9` on Sepolia | Anti-Sybil without a custom identity contract |
| Frontend | **Vite 5** + **React 18** + **wagmi v2** + **viem v2** + **RainbowKit 2** + **Tailwind 3** | Best-in-class Web3 stack |
| Relayer | **Fastify 5** + **viem** + **@aws-sdk/client-s3** + **@fastify/multipart** | Tiny, typed, production-ready |
| IPFS | **Filebase** via S3-compatible API | Set-and-forget pinning; free tier; no cold-storage ops |
| Linting | **ESLint 9** flat + **Prettier 3** + **solhint** | Shared at root |

---

## Project layout

```
giglock/
├── README.md                       ← you are here
├── docs/
│   ├── DEPLOY.md                   ← operational handbook (~600 lines)
│   └── superpowers/
│       ├── plans/                  ← implementation plans (per-task TDD spec)
│       └── specs/                  ← design specs (when brainstorming writes them)
├── packages/
│   ├── contracts/                  ← Hardhat 3 + viem toolbox
│   ├── shared/                     ← typed ABIs + chain defs + EIP-712 builders
│   ├── frontend/                   ← Vite + React + wagmi (port 5173)
│   └── relayer/                    ← Fastify + Filebase pin route (port 8080)
├── runner-local.sh                 ← one-command local dev
├── runner-stop.sh                  ← kill switch for runner-local.sh
├── vercel.json                     ← (in packages/frontend/)
├── Dockerfile + render.yaml        ← (in packages/relayer/)
├── .github/workflows/ci.yml        ← CI on every PR
└── .dockerignore                   ← Docker build exclusions
```

---

## What we deferred (and why)

Documented honestly so the gaps don't look like oversights:

- **`/meta-tx` route in the relayer** — the EIP-2771 + MinimalForwarder plumbing that gives workers "zero ETH" UX. Plan in `docs/superpowers/plans/`. The escrow state machine is built and tested; only the gasless wrapper is missing.
- **HH3 test shim** (`packages/contracts/plugins/test-shim.ts`) — a small adapter because HH3's viem-toolbox API differs from HH2. Refactor to idiomatic HH3 (`await network.connect().viem`, `import { describe, it } from "node:test"`) when we have more contract work; not blocking.
- **Multi-arbiter staking jury** — single admin v0 in `Arbiter.sol`. v1 (staked jurors) is post-MVP.
- **The Graph subgraph** — direct `eth_getLogs` works fine until ~1k jobs. See §10.2 of `DEPLOY.md`.
- **Frontend routes beyond the landing page** — Dashboard, Post-Job, Job-Detail. The mockup is at `ui reference/`. Each route is a follow-up plan.

---

## Documentation map

| Doc | What's in it |
|---|---|
| [`README.md`](README.md) | This file — what + how to run + how to deploy. |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | The operator's handbook. Wallet setup, Ignition, Vercel, Render, Filebase, demo script, security checklist, costs, troubleshooting. |
| `project docs/GigLock Documentation.md` | The original pitch doc (Indonesian). Why this matters, market, problem statement. |
| `project docs/GigLock Technical Spec.md` | The original technical spec — every contract's interface, every sequence diagram. Reference for understanding the contracts' behavior. |
| `docs/superpowers/plans/*.md` | The actual TDD-style implementation plans we executed. Useful for understanding the design decisions. |
| `ui reference/*.png` | The UI mockup for the dashboard, used as a reference for the upcoming frontend-routes plan. |

---

## Contributing

Open an issue on <https://github.com/krisnasirait/GigLock/issues> for bugs or questions.

When adding a new feature:
1. Check `docs/superpowers/plans/` for relevant plans / open work
2. Follow the existing monorepo conventions (workspace deps, shared types, per-package tests)
3. Add a CI-friendly test (`pnpm --filter @giglock/<pkg> test`)
4. Keep `pnpm typecheck` green

---

## License

[MIT](LICENSE) © 2026 krisnasirait

---

_Made for the GIWA hackathon. Open source. Have fun._
