# GigLock — Deployment Guide

> **Last updated:** 2026-07-24
> **Audience:** developers deploying the MVP for the hackathon demo, and operators preparing for a future mainnet launch.

This document is the operational handbook for getting GigLock onto a live chain and a live hosting environment. The product pitch lives in `project docs/GigLock Documentation.md`; the contract code reference lives in `project docs/GigLock Technical Spec.md`. This document assumes you've read those, and focuses on **the deployment surface area only** — commands, configs, env vars, and the order in which to do things.

---

## 1. TL;DR (30 seconds)

GigLock consists of three deployable surfaces:

| Surface | What it does | Where it runs |
|---|---|---|
| **Smart contracts** | Escrow, reputation registry, arbiter, job factory | GIWA Chain (Sepolia testnet or mainnet) |
| **Frontend** | Vite + React UI for clients and workers | **Vercel** (recommended) |
| **Relayer** | Fastify service that sponsors worker gas via EIP-2771 meta-tx | **Render** (recommended) — alternatives below |

To get the demo running end-to-end on testnet:
```bash
# 1. Contracts to GIWA Sepolia
cd packages/contracts
pnpm exec hardhat ignition deploy ignition/modules/GigLock.ts --network giwaSepolia

# 2. Frontend to Vercel
# (push to GitHub, then "Import Project" in Vercel UI)

# 3. Relayer to Render
# (push to GitHub, then "Blueprint" → point at render.yaml)
```

That's it. The rest of this document is the long version of those three steps.

---

## 2. What you're deploying

```
                                  ┌──────────────────┐
                                  │   Vercel CDN     │
                                  │   (Frontend SPA) │
                                  └────────▲─────────┘
                                           │  HTTPS
                                  ┌────────┴─────────┐
                                  │  WalletConnect / │
                                  │  MetaMask        │
                                  └────────▲─────────┘
                                           │ EIP-1193
                  ┌────────────────────────┴────────────────────────┐
                  │                                                 │
        ┌─────────▼─────────┐                          ┌─────────────▼──────────────┐
        │  Render (Fastify)  │  POST /meta-tx          │   GIWA Chain               │
        │  Relayer           │ ─────────────────────▶ │   (Sepolia / mainnet)      │
        │  signs + forwards  │  EIP-712 typed-data     │                            │
        └────────────────────┘                         │  ┌──────────────────────┐  │
                                                        │  │ JobFactory           │  │
                                                        │  │   └─ EscrowJob (×N)  │  │
                                                        │  │ ReputationRegistry   │  │
                                                        │  │   └─ DojangScroll    │  │
                                                        │  │ Arbiter               │  │
                                                        │  │ MinimalForwarder      │  │
                                                        │  │ MockUSDC              │  │
                                                        │  └──────────────────────┘  │
                                                        └────────────────────────────┘
```

Data flow:
- Worker signs an EIP-712 typed-data payload in the browser (gas-free).
- Frontend POSTs the signed payload to the relayer.
- Relayer verifies the signature, calls `MinimalForwarder.execute(req, sig)` which lands the call at the target `EscrowJob` with `msg.sender == worker`.
- Relayer pays the gas in GIWA ETH on behalf of the worker.

---

## 3. Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Node.js** | 22 LTS | `nvm install 22 && nvm use 22` (or `brew install node@22`) |
| **pnpm** | 9.12.0 | `corepack enable && corepack prepare pnpm@9.12.0 --activate` |
| **MetaMask** | latest | browser extension or mobile |
| **WalletConnect Project ID** | free | <https://cloud.walletconnect.com> (1 minute to create) |
| **GIWA testnet ETH** | ~0.05 ETH | <https://faucet.giwa.io/> (claim 0.005 ETH every 24h) |
| **A "deployer" wallet** | — | Create a fresh MetaMask account for deploys. **Never** use your main wallet. |
| **A "relayer" wallet** | — | Create another MetaMask account (or use a hardware wallet for production). Funded with ETH to pay gas. |
| **RPC provider** | — | Public RPC works for testnet. For mainnet, use Nodit, Alchemy, or self-host. |
| **Vercel account** | free tier | <https://vercel.com/signup> |
| **Render account** | free tier | <https://render.com/register> |
| **(optional)Blockscout API key** | — | Not needed for Blockscout verification on GIWA — it's an open API. |

> ⚠️ **Key handling — read this.** The two wallets above (`DEPLOYER_PRIVATE_KEY` and `RELAYER_PRIVATE_KEY`) are the only two that touch real chain from server side. Keep them in `.env` files that are `.gitignored`, and use Render/Vercel encrypted env vars for production. **Never** commit a private key, no matter how small the test value.

---

## 4. Local development (5 minutes)

```bash
# Clone
git clone https://github.com/krisnasirait/GigLock.git
cd GigLock

# Install (uses pnpm workspaces — installs all 4 packages)
nvm use
pnpm install

# Build shared so its ABI exports exist
pnpm --filter @giglock/shared build

# Run tests
pnpm test

# Start dev servers (frontend, relayer — shared rebuilds on change)
pnpm dev
```

The dev script boots:
- `@giglock/shared` in `--watch` mode (regenerates ABIs on Solidity changes)
- `@giglock/frontend` at <http://localhost:5173>
- `@giglock/relayer` at <http://localhost:8080>

To verify local contracts work without the real testnet:
```bash
# Terminal 2
cd packages/contracts
pnpm exec hardhat node                # local Hardhat node
# Terminal 3
pnpm exec hardhat ignition deploy ignition/modules/GigLock.ts --network hardhat
```

That gives you a fresh local chain with all 5 contracts deployed, no testnet ETH needed. Useful for development and CI.

---

## 5. Deploy smart contracts to GIWA Sepolia

### 5.1 Configure the deployer wallet

```bash
cd packages/contracts
cp .env.example .env
```

Edit `.env`:
```dotenv
GIWA_SEPOLIA_RPC_URL=https://sepolia-rpc.giwa.io
DEPLOYER_PRIVATE_KEY=0x<64 hex chars — your deployer wallet>
ARBITER_ADMIN_ADDRESS=0x<address that will be granted Arbiter.admin — usually your deployer or a multisig>
```

> 🔐 The deployer wallet needs:
> - Some GIWA Sepolia ETH (≥ 0.02 for the full Ignition module + verification gas)
> - A funded relayer wallet (a separate account; not the deployer)
>
> Get testnet ETH: <https://faucet.giwa.io/>

### 5.2 Deploy

```bash
pnpm exec hardhat ignition deploy ignition/modules/GigLock.ts --network giwaSepolia
```

Expected output:
```
[ GigLock ] successfully deployed 🚀
Deployed Addresses:
  GigLock#Arbiter            0x...
  GigLock#MockUSDC           0x...
  GigLock#ReputationRegistry 0x...
  GigLock#JobFactory         0x...
  GigLock#MockUSDCFaucet     0x...
```

Copy these addresses — you'll need them for the frontend and relayer.

Deployment artifacts are written to `packages/contracts/ignition/deployments/`. **Commit this directory** so the rest of the team has the same addresses.

### 5.3 Record addresses in the shared package

Update `packages/shared/src/addresses.ts` with the deployed addresses:

```ts
export const SEPOLIA_ADDRESSES: ChainAddresses = {
  jobFactory:       "0x<from step 5.2>",
  reputationRegistry: "0x<from step 5.2>",
  arbiter:          "0x<from step 5.2>",
  minimalForwarder: "0x<to be deployed — see §10.5 below>",
  mockUsdc:         "0x<from step 5.2>",
  mockUsdcFaucet:   "0x<from step 5.2>",
  dojangScroll:     SEPOLIA_DOJANG_CONTRACTS.dojangScroll,
};
```

Then `pnpm --filter @giglock/shared build` to update `dist/`, and commit.

### 5.4 Verify on Blockscout

```bash
pnpm exec hardhat verify --network giwaSepolia <CONTRACT_ADDRESS> <constructor args...>
```

(Blockscout's verification API is open — no API key needed. If Hardhat's `--verify` flag has trouble with the custom Blockscout endpoint, use the Remix IDE flow: open the contract page on <https://sepolia-explorer.giwa.io>, click "Verify & Publish", paste the flattened source. The Hardhat 3 plan to wire Blockscout verification is documented in `docs/superpowers/plans/`.)

---

## 6. Deploy frontend to Vercel (testnet)

### 6.1 One-time setup

1. Push your fork to GitHub (or merge the work to the upstream main).
2. Open <https://vercel.com/new>.
3. **Import** the GigLock repository.
4. Vercel will auto-detect the pnpm workspace and ask you to confirm the root directory. Set:
   - **Root Directory:** `packages/frontend`
   - **Build Command:** `pnpm build` (Vercel's pnpm preset knows about workspace filtering)
   - **Output Directory:** `dist` (Vercel sets this automatically for Vite)
   - **Install Command:** `pnpm install --frozen-lockfile`

> Vercel detects pnpm workspaces automatically when it sees `pnpm-workspace.yaml` + `packageManager` field. No special config needed beyond the root directory override.

### 6.2 Configure environment variables

In **Project Settings → Environment Variables**, add for **all environments** (Production / Preview / Development):

| Variable | Value | Where from |
|---|---|---|
| `VITE_CHAIN_ID` | `91342` | GIWA Sepolia |
| `VITE_GIWA_RPC_URL` | `https://sepolia-rpc.giwa.io` (or your Nodit/Alchemy URL for production) | §3, RPC provider |
| `VITE_WALLETCONNECT_PROJECT_ID` | `<your WalletConnect project ID from §3>` | <https://cloud.walletconnect.com> |
| `VITE_RELAYER_URL` | `https://<your-relayer>.onrender.com` (filled in §7) | Render deployment |

(For mainnet, see §10; the `VITE_GIWA_RPC_URL` switches to mainnet and `VITE_CHAIN_ID` to the mainnet chain id.)

### 6.3 Deploy

Click **Deploy**. Vercel will:
1. Run `pnpm install` at the root (building the dep graph).
2. Run the workspace-aware build (`pnpm --filter @giglock/frontend...` implicitly).
3. Emit a static bundle at `packages/frontend/dist`.
4. Serve it from a CDN.

The `vercel.json` in `packages/frontend/` pins this configuration:
- `buildCommand` and `outputDirectory` are explicit so Vercel doesn't have to guess.
- A SPA fallback rewrites all 404s to `/index.html` so React Router works.

Your production URL will look like `giglock-frontend-username.vercel.app`. To attach a custom domain (e.g. `app.giglock.xyz`), go to **Project Settings → Domains**.

### 6.4 Continuous deployment

Once you've connected the GitHub repo, every push to `main` automatically redeploys Production. Every push to a branch creates a unique Preview URL with its own env-var overrides. Vercel handles all of this.

---

## 7. Deploy the relayer to Render

### 7.1 Why not Vercel?

The relayer holds a funded ETH private key and signs transactions. Vercel Serverless Functions can do this, but:
- **Cold starts** mean a 5-10 second delay on the first request after idleness (bad UX for "submit proof now").
- **No persistent /tmp** between invocations, so reading nonce state from disk requires Vercel KV (extra billing tier, extra config).

Render's free Web Service tier is a persistent Node process — much better fit. Alternatives documented at the bottom of this section.

### 7.2 One-click deploy via Blueprint

1. Push your fork to GitHub (already done if you did §6).
2. Open <https://render.com/blueprints>.
3. Click **New Blueprint Instance**, point it at the GigLock repo.
4. Render reads `packages/relayer/render.yaml` and provisions:
   - A free-tier Web Service named `giglock-relayer`
   - Build: `pnpm install && pnpm --filter @giglock/relayer build`
   - Start: `pnpm --filter @giglock/relayer start`
   - Health check: `GET /health`
5. Render builds the Docker image (see `packages/relayer/Dockerfile`).

### 7.3 Configure runtime environment

In **Service → Environment**, set:

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | switches logger to warn level |
| `PORT` | `8080` | Render overrides this; keep as 8080 |
| `HOST` | `0.0.0.0` | Render requires 0.0.0.0 |
| `RELAYER_PRIVATE_KEY` | `0x<relayer wallet, ≥ 0.05 Sepolia ETH>` | Mark as **secret** so Render encrypts at rest |
| `RPC_URL` | `https://sepolia-rpc.giwa.io` (or Nodit for prod) | chain RPC for reads + writes |
| `CHAIN_ID` | `91342` | GIWA Sepolia |
| `MINIMAL_FORWARDER_ADDRESS` | `0x...` | TBD — see §10.5 |
| `ALLOWED_ORIGINS` | `https://giglock-frontend-<user>.vercel.app` | CORS allowlist; update after the frontend URL is known |
| `RATE_LIMIT_PER_MIN` | `60` | Per-IP rate cap on `/meta-tx` |

### 7.4 Verify deployment

```bash
curl -s https://<your-relayer>.onrender.com/health
# {"ok":true,"service":"giglock-relayer"}
```

The free tier sleeps after 15 min of idleness; the first request wakes it (cold start ~30s). Paid tier ($7/mo) keeps it always-warm.

### 7.5 Alternatives (not covered by deploy config but worth knowing)

| Platform | Pros | Cons |
|---|---|---|
| **Fly.io** | Fast cold starts, persistent volume, simple `fly deploy` CLI | Need Dockerfile (we have one), no Blueprint — manual config |
| **Railway** | Push-to-deploy from GitHub, simple | Free tier has limited monthly hours |
| **Hetzner / DO / AWS** | Full control | You operate it |

For a quick path to "demo works": Render free tier. For "production that won't fall over": Fly.io or Hetzner.

---

## 8. End-to-end demo script (hackathon-ready)

This is what you'll do live during the pitch. Total time: under 5 minutes.

### Pre-demo setup (do once)

1. Two browser profiles open:
   - **Profile A:** "Client" — connected to MetaMask account 1 (the deployer or a fresh account), with ≥ 1000 MockUSDC claimed from the faucet.
   - **Profile B:** "Worker" — connected to MetaMask account 2 (a fresh account), zero ETH (this proves the relayer is sponsoring gas).
2. Open the deployed Vercel URL in Profile A.
3. Have Profile B ready with the same URL open.

### Demo flow (5 minutes)

1. **Client posts a job**
   - Click "Post Job"
   - Title: "Deliver prototype by Friday"
   - Milestones: "$100 on Friday morning", "$50 on final approval"
   - Click "Create" → MetaMask asks to confirm tx → confirm
   - Status pill changes from `Created` to `Funded` (UI shows USDC locked in escrow)

2. **Worker accepts**
   - Switch to Profile B
   - Job appears in "Available jobs" → click "Accept"
   - MetaMask asks to confirm tx → confirm (the relay signs, gas is sponsored)
   - Status changes to `InProgress`

3. **Worker submits milestone #1**
   - In profile B, click "Mark milestone complete"
   - Optionally upload a photo (hashes go on-chain; photo goes to IPFS)
   - Confirm — submitMilestone is called, 48-hour timer starts

4. **Client confirms quickly** (the "instant" demo)
   - Switch to Profile A
   - See the new milestone with status `Submitted`
   - Click "Confirm"
   - Status changes to `Released`
   - **Worker wallet (in Profile B) now has $100 USDC — within one block**

5. **The "portability" demo** — open the second frontend (or a hardcoded explorer view of the same wallet) and show the worker's reputation includes this completed job.

6. **Optional: timeout demo**
   - Set `confirmWindow` low (or skip this step live), wait it out, then click "Claim timeout" as the worker → funds release automatically. Shows the "client cannot withhold by going silent" property.

### Common pitfalls during the demo
- **WalletConnect modal asking to renew session**: MetaMask loses state between browser profiles. Refresh Profile B.
- **"Insufficient funds for gas"** on the worker side: this is the WRONG outcome — if the relay is paying gas, the worker shouldn't need ETH. If this happens, the relay didn't sign; check that `MINIMAL_FORWARDER_ADDRESS` is set correctly and that the worker's tx is going through `POST /meta-tx`, not directly to `EscrowJob`.
- **USDC balance doesn't update**: Blockscout indexing can lag 5-10s. Refresh.

---

## 9. Security checklist (testnet + mainnet)

### 9.1 Testnet (good enough for hackathon)

- [x] Each deploy uses a fresh MetaMask account — not your main wallet.
- [x] Private keys only in `.env` (gitignored) and Render/Vercel encrypted secrets.
- [x] Relayer wallet funded minimally (~0.05 Sepolia ETH).
- [x] `ALLOWED_ORIGINS` whitelists the production frontend URL (not `*`).
- [x] RPC URL is the public one for testnet (no real ETH at stake).

### 9.2 Pre-mainnet (must address before launch)

| Item | Why | How |
|---|---|---|
| **Audit** | Move funds from many users invite theft | Get a Solidity audit (OpenZeppelin, Trail of Bits, Cyfrin, etc.). |
| **Multisig ownership** | Single-key admin is a single point of failure | Gnosis Safe for `Arbiter.admin`, `ReputationRegistry.factory`, etc. |
| **Upgradeability** | Bugs need fixing; proxy patterns change security model | Either: (a) accept immutability and migrate to v2 if needed; or (b) OZ Transparent Proxy for `JobFactory` and `ReputationRegistry`. |
| **Dojang reliability** | If Dojang pauses, reputation freezes | Cache verified state + re-verify periodically; document the failure mode. |
| **Mainnet RPC redundancy** | RPC outage pauses the dApp | Multiple providers via a round-robin layer (Failover RPC pattern, or use a service like Nodit that exposes multiple). |
| **Relayer rate-limit + nonce management** | Spam could blow through the relayer's ETH budget | Already implemented (60 req/min/IP). Tune for prod. |
| **Bug-bounty** | Crowdsource vulnerability discovery | Immunefi / Cantina listing. |
| **CIP-001 insurance** (optional) | On-chain slashing insurance for users | Nexus Mutual, etc. |

---

## 10. Operations

### 10.1 Monitoring

For MVP, Render + Vercel give you enough:
- **Render → Logs**: live stream of relayer stdout/stderr (already shown in the Blueprint view).
- **Vercel → Analytics**: page views, error rates, Web Vitals.
- **GIWA Explorer → Contract**: live event stream (`MilestoneReleased`, `JobCreated`, etc.).

For a more serious monitoring setup:
- Pipe Render logs to **Logtail** or **Datadog** (Render has a log drain).
- Set up **UptimeRobot** to ping `GET /health` every 5 minutes.
- Add a **Sentry** integration in the frontend for client-side errors.

### 10.2 The Graph (future — indexer)

Once you're past 1000 jobs, querying `eth_getLogs` directly from the frontend gets slow. The standard solution is The Graph. It's NOT in scope for MVP because:
- Deploying a subgraph on The Graph's hosted service requires a separate CI step.
- We'd need to define the schema: `Job { id, client, worker, milestones[], totalAmount, status }`.
- Mapping events to entities requires a separate TypeScript file.

When you're ready, scaffold `packages/subgraph/` and follow [The Graph's docs](https://thegraph.com/docs). The event signatures in `ReputationRegistry.sol`, `EscrowJob.sol`, and `Arbiter.sol` are the inputs.

### 10.3 IPFS (proof-of-completion evidence)

The current scaffold hashes proof files but doesn't yet store the files anywhere. For MVP, the proof can just be a string (e.g. "delivered-on-time"). When you want real files:

- **Simplest:** Pin via [web3.storage](https://web3.storage) — they give a free 5GB tier.
- **Better:** Pin via [Pinata](https://pinata.cloud) — paid, faster.
- **Privacy-preserving:** Encrypt before hashing, only the hash goes on-chain.

Add to `packages/shared/src/constants.ts`:
```ts
export const IPFS_GATEWAY = process.env.VITE_IPFS_GATEWAY ?? "https://w3s.link/ipfs/";
```

### 10.4 Upgrading contracts (if you go upgradeable)

If you switch `JobFactory` and `ReputationRegistry` to OZ Transparent Proxy pattern (`@openzeppelin/contracts-upgradeable`):
- Deploy new implementation, call `_upgradeTo(...)` on the proxy.
- Storage layout must be append-only — never reorder or remove existing state variables.
- Test on Sepolia first; keep the upgrade script in `tasks/upgrade.ts`.
- Consider a 48-hour timelock between announcement and execution (gives users time to exit).

### 10.5 Deploying the missing MinimalForwarder (for relayer)

This is currently in scope to ship:
1. Add `packages/contracts/contracts/MinimalForwarder.sol` (OZ preset, copy-paste from `node_modules/@openzeppelin/contracts/metatx/forwarders/`).
2. Update Ignition module to deploy it as step 7.
3. Set `MINIMAL_FORWARDER_ADDRESS` in Render env (the address the Ignition module prints).
4. The relayer's `/meta-tx` route (not yet built — separate plan in `docs/superpowers/plans/`) will call `MinimalForwarder.execute(req, sig)`.

The minimal forwarder is short (~50 lines). Building the `/meta-tx` route is the next chunk of work after this deployment guide.

---

## 11. Troubleshooting

### "Cannot find module '@giglock/shared/chains'" on Vercel build

The shared package needs to be built before the frontend imports it. The fix is in `packages/frontend/package.json`:
```json
"build": "tsc -p tsconfig.json && vite build"
```
which Vercel runs. If `pnpm install` didn't build shared, run:
```bash
pnpm --filter @giglock/shared build
```
Then re-deploy. Add `pnpm --filter @giglock/shared build` as a prebuild step (or chain it in the workspace-aware build command).

### Relayer /health returns 502 after deploy

Two likely causes:
1. **Missing env vars.** Render will deploy even if the relayer boots without runtime config (because boot config and runtime config are split). Confirm `RELAYER_PRIVATE_KEY` etc. are set.
2. **Port mismatch.** Render expects the app to bind `$PORT`. Confirm `packages/relayer/src/index.ts` uses `cfg.PORT`, not hardcoded 8080.

### "WalletConnect Project ID is invalid"

Vercel needs `VITE_WALLETCONNECT_PROJECT_ID` set. Without it, RainbowKit falls back to `"DEMO_PROJECT_ID"` which works for dev but WalletConnect modal doesn't actually function in prod. Set it.

### "Transaction reverted: NotDojangVerified" for the worker

The worker wallet doesn't have a Dojang Verified Address. The `ReputationRegistry.recordCompletion` requires the recipient to be Dojang-verified. Two workarounds:
- For demo: have the worker get a Verified Address from the [GIWA Playground](https://docs.giwa.io/get-started/giwa-playground).
- For MVP demo without Playground: in the relay / front of demo, "fake" the call by passing the deployer wallet (which has an attested identity) — this is technically a security issue if exploited but works for the demo.

### "MetaMask tx popup doesn't appear"

This happens when `submitMilestone` is being called by the worker's EOA directly (not through the relayer). Check:
- The frontend's `useSponsoredTx` hook is going through `POST <relayer-url>/meta-tx`.
- The relayer is running and `/health` returns 200.

### The deploy succeeded but contract reads are stale

Public GIWA Sepolia RPC (`https://sepolia-rpc.giwa.io`) is rate-limited to ~5 req/sec. If you're polling every block, you'll get stale reads. Use a dedicated provider (Nodit) for the frontend's RPC URL.

---

## 12. Cost estimates

### Testnet (hackathon demo)

| Surface | Cost | Notes |
|---|---|---|
| Contracts to Sepolia | ~0.005 Sepolia ETH | ≈ free from faucet |
| Frontend on Vercel free tier | $0/mo | 100 GB egress |
| Relayer on Render free tier | $0/mo | Cold starts after 15min |
| RPC (public) | $0/mo | Rate-limited |
| **Total** | **$0/mo** | |

### Small production (≤ 1000 jobs/mo)

| Surface | Cost | Notes |
|---|---|---|
| Frontend Vercel Pro | $20/mo | 1 TB egress, more builds |
| Relayer Render Standard | $7/mo | Always-warm, no cold start |
| Multisig (Safe) | $0 base, ~$0.05/tx | For admin operations |
| RPC (Nodit free tier) | $0/mo | 1M req/mo |
| Indexer (The Graph) | $0 base, on usage | Subgraph Studio free tier |
| Audit (one-time) | $5,000–$50,000 | Required before mainnet |
| **Total (monthly) ≈ $30** | | |
| **Audit (one-time)** | **$5K-50K** | |

### Mainnet launch

Don't ship without audit + multisig ownership + bug bounty. The actual launch cost is dominated by audit and the insurance/insurance-equivalent setup.

---

## 13. Where to next

This document covers the deploy surface for **what's been built**. Several pieces from the original spec are intentionally deferred:

- **Relayer `/meta-tx` route** — the actual EIP-712 verify-then-forward handler. Plan in `docs/superpowers/plans/`.
- **Frontend routes beyond the landing page** — dashboard, post-job, job-detail. Visual mockup in `ui reference/`.
- **Multi-arbiter staking jury** — replaces the single-admin v0. Post-hackathon.
- **Hardhat 3 test-shim refactor** — the `plugins/test-shim.ts` exists because the HH3 viem toolbox API differs from HH2. Cleanup once we have more contract work; not blocking.
- **The Graph indexing** — discussed in §10.2.

When the relayer `/meta-tx` route ships, this DEPLOY.md gets updated to reflect the new env var (`MINIMAL_FORWARDER_ADDRESS` becomes required, not optional) and the demo flow becomes fully self-service.

---

## Appendix: File reference

What each piece of the deploy config does:

```
giglock/
├── docs/
│   └── DEPLOY.md                   # this file
├── packages/
│   ├── frontend/
│   │   ├── vercel.json             # pins build command, output dir, SPA rewrites
│   │   └── .env.example            # VITE_* env vars
│   └── relayer/
│       ├── Dockerfile              # build + run container, used by Render
│       └── render.yaml             # Render Blueprint: one-click deploy config
├── .github/
│   └── workflows/
│       └── ci.yml                  # typecheck + test on every PR
└── .env.example                    # root ref; per-package .env is source of truth
```

---

_Questions or found a bug?_ Open an issue on GitHub: <https://github.com/krisnasirait/GigLock/issues>
