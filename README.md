# GigLock

Instant pay and portable reputation for gig workers, built on GIWA Chain.

> **Status:** Scaffold base (v0.1.0). Feature implementation tracked in `docs/superpowers/plans/`.

## Packages

| Package | Purpose |
|---|---|
| `packages/contracts` | Solidity smart contracts (Hardhat 3 + viem + Ignition) |
| `packages/shared` | Typed ABIs, GIWA chain def, EIP-712 builders |
| `packages/frontend` | Vite + React + wagmi + RainbowKit UI |
| `packages/relayer` | Fastify EIP-2771 meta-tx relayer (sponsors worker gas) |

## Quickstart

```bash
nvm use                # Node 22
pnpm install
pnpm -r --if-present run typecheck
pnpm build
pnpm test
pnpm dev               # boots shared + frontend + relayer in parallel
```

## Deploy to GIWA Sepolia

```bash
cp packages/contracts/.env.example packages/contracts/.env   # fill in DEPLOYER_PRIVATE_KEY
cd packages/contracts
pnpm exec hardhat ignition deploy ignition/modules/GigLock.ts --network giwaSepolia
```

## Docs

- Architecture plan: `~/.claude/plans/wise-purring-wirth.md`
- Product spec: `project docs/GigLock Documentation.md`
- Technical spec: `project docs/GigLock Technical Spec.md`
- UI mockup: `ui reference/ChatGPT Image Jul 22 2026 from GigLock.png`
