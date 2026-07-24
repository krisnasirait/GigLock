# GigLock dApp Happy-Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a two-wallet GIWA Sepolia dApp flow that claims MockUSDC, creates and funds an IPFS-described job, accepts it, submits IPFS evidence, and confirms payment.

**Architecture:** Extend and redeploy the factory/escrow contracts with job and proof CID support. Build typed frontend domain, IPFS, chain-read, and transaction-workflow modules consumed by three focused React routes. React Query owns remote state; wagmi owns direct-wallet writes; confirmed receipts invalidate exact query keys.

**Tech Stack:** Solidity 0.8.24, Hardhat 3, Ignition, React 18, TypeScript 5, React Router 7, wagmi 2, viem 2, TanStack React Query 5, Vitest 2, Testing Library, Tailwind CSS, GIWA Sepolia, Render/Filebase IPFS.

## Global Constraints

- Direct wallet transactions only; chain ID must be `91342`.
- Metadata schema discriminator is exactly `giglock/job@1`.
- Metadata and proof CIDs are non-empty and at most 128 bytes on-chain.
- Proof hash is Keccak-256 of the uploaded bytes and cannot be zero.
- Job metadata is reconstructable from chain-referenced IPFS without local storage.
- Milestones: 1–10; amounts use six USDC decimals and must be positive.
- Evidence upload limit is 10 MiB.
- No private key, Filebase credential, or other secret enters frontend code or Git.
- Disputes, timeout claims, ratings, arbiter UI, and gasless transactions remain out of scope.

## File structure

- Modify `packages/contracts/contracts/EscrowJob.sol`: store/validate metadata and proof CIDs.
- Modify `packages/contracts/contracts/JobFactory.sol`: accept and emit metadata CID.
- Modify `packages/contracts/test/EscrowJob.test.ts`: contract CID and unchanged-flow tests.
- Modify `packages/contracts/test/JobFactory.test.ts`: factory CID and validation tests.
- Modify `packages/contracts/ignition/modules/GigLock.ts`: deploy revised contracts unchanged in topology.
- Regenerate `packages/shared/src/abis/*.ts`.
- Modify `packages/shared/src/addresses.ts`: new deployment addresses.
- Create `packages/frontend/src/features/jobs/model.ts`: metadata schema, normalization, formatting, action derivation.
- Create `packages/frontend/src/features/jobs/model.test.ts`: pure domain tests.
- Create `packages/frontend/src/features/jobs/ipfs.ts`: metadata/evidence pin and fetch helpers.
- Create `packages/frontend/src/features/jobs/queries.ts`: factory/job reads and query keys.
- Create `packages/frontend/src/features/jobs/transactions.ts`: receipt-backed direct-write workflows.
- Create `packages/frontend/src/features/jobs/components/*.tsx`: reusable wallet, job, milestone, and transaction UI.
- Create `packages/frontend/src/pages/AppDashboardPage.tsx`.
- Create `packages/frontend/src/pages/NewJobPage.tsx`.
- Create `packages/frontend/src/pages/JobDetailPage.tsx`.
- Modify `packages/frontend/src/App.tsx`: replace `/app` placeholder and add nested job routes.
- Modify `packages/frontend/src/features/protocolMetrics/query.ts`: use new deployment block.
- Modify `docs/DEPLOY.md` and package environment examples.

---

### Task 1: Store job and evidence CIDs on-chain

**Files:**
- Modify: `packages/contracts/test/EscrowJob.test.ts`
- Modify: `packages/contracts/test/JobFactory.test.ts`
- Modify: `packages/contracts/contracts/EscrowJob.sol`
- Modify: `packages/contracts/contracts/JobFactory.sol`

**Interfaces:**
- Produces: `createJob(uint256[],string)`, `metadataCid()`, `submitMilestone(uint256,bytes32,string)`, and milestone getter with `proofCid`.
- Consumers: generated ABIs and all frontend transaction/read modules.

- [ ] **Step 1: Update tests first for metadata CID creation**

Change test setup calls to:

```ts
args: [[parseUnits("100", 6), parseUnits("50", 6)], "bafy-job-metadata"]
```

Add:

```ts
it("stores metadata CID on the created escrow", async () => {
  const { jobAddr } = await setup();
  const job = await hre.viem.getContractAt("EscrowJob", jobAddr);
  expect(await job.read.metadataCid()).to.equal("bafy-job-metadata");
});

it("rejects empty and overlong metadata CIDs", async () => {
  const { factory, client, publicClient } = await deployAll();
  for (const cid of ["", "x".repeat(129)]) {
    await expectRevert(client.writeContract({
      address: factory.address,
      abi: factory.abi,
      functionName: "createJob",
      args: [[1_000_000n], cid],
      account: client.account,
    } as any).then((hash: any) => publicClient.waitForTransactionReceipt({ hash })));
  }
});
```

- [ ] **Step 2: Update tests first for proof CID and hash**

Change submissions to:

```ts
args: [0n, ("0x" + "11".repeat(32)) as `0x${string}`, "bafy-proof"]
```

Add assertions:

```ts
const milestone = await job.read.milestones([0n]);
expect(milestone[2]).to.equal(("0x" + "11".repeat(32)));
expect(milestone[3]).to.equal("bafy-proof");
```

Add rejection cases for zero hash, empty CID, and `"x".repeat(129)`.

- [ ] **Step 3: Run contract tests and verify RED**

Run: `pnpm --filter @giglock/contracts test`  
Expected: compile/type failures because the Solidity signatures and tuple are unchanged.

- [ ] **Step 4: Implement the minimal Solidity revision**

Add:

```solidity
uint256 private constant MAX_CID_LENGTH = 128;
string public metadataCid;
```

Extend `Milestone` with `string proofCid`, initialize it with `""`, validate CID
byte lengths, store proof hash/CID, and emit the revised event. Pass and emit the
metadata CID in `JobFactory`.

- [ ] **Step 5: Run focused and full contract tests**

Run: `pnpm --filter @giglock/contracts test`  
Expected: all existing and new tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/contracts/EscrowJob.sol packages/contracts/contracts/JobFactory.sol packages/contracts/test/EscrowJob.test.ts packages/contracts/test/JobFactory.test.ts
git commit -m "feat(contracts): persist job and proof metadata CIDs"
```

### Task 2: Regenerate ABIs and prepare deployment

**Files:**
- Modify generated: `packages/shared/src/abis/escrow-job.ts`
- Modify generated: `packages/shared/src/abis/job-factory.ts`
- Verify: `packages/contracts/ignition/modules/GigLock.ts`

**Interfaces:**
- Consumes: revised Solidity artifacts.
- Produces: frontend-safe `EscrowJobAbi` and `JobFactoryAbi`.

- [ ] **Step 1: Compile and regenerate**

Run:

```bash
pnpm --filter @giglock/contracts compile
pnpm --filter @giglock/shared build
```

Expected: generated ABIs include `metadataCid`, the three-argument
`submitMilestone`, proof CID tuple output, and two-argument `createJob`.

- [ ] **Step 2: Add ABI shape assertions**

Create `packages/shared/src/abis/metadata-abi.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EscrowJobAbi } from "./escrow-job.js";
import { JobFactoryAbi } from "./job-factory.js";

it("exports CID-aware write signatures", () => {
  expect(EscrowJobAbi.find((item) => item.type === "function" && item.name === "submitMilestone")?.inputs).toHaveLength(3);
  expect(JobFactoryAbi.find((item) => item.type === "function" && item.name === "createJob")?.inputs).toHaveLength(2);
});
```

If shared has no Vitest runner, place the assertion in the frontend model test
and import the ABIs from `@giglock/shared`.

- [ ] **Step 3: Run ABI assertion and shared build**

Run: `pnpm --filter @giglock/shared build && pnpm --filter @giglock/frontend test`  
Expected: ABI shape assertion passes.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/abis packages/contracts/ignition/modules/GigLock.ts
git commit -m "chore(shared): regenerate CID-aware contract ABIs"
```

### Task 3: Job metadata and action domain

**Files:**
- Create: `packages/frontend/src/features/jobs/model.ts`
- Create: `packages/frontend/src/features/jobs/model.test.ts`

**Interfaces:**
- Produces:
  - `JobMetadataV1`
  - `parseJobMetadata(value: unknown): JobMetadataV1`
  - `serializeJobMetadata(input): string`
  - `parseUsdcAmount(value: string): bigint`
  - `deriveJobActions(snapshot, account): JobAction[]`
  - `normalizeMilestone(tuple, metadata, index): MilestoneView`

- [ ] **Step 1: Write failing metadata and amount tests**

```ts
expect(parseUsdcAmount("12.345678")).toBe(12_345_678n);
expect(() => parseUsdcAmount("0")).toThrow("greater than zero");
expect(() => parseUsdcAmount("1.0000001")).toThrow("six decimals");
expect(parseJobMetadata(JSON.parse(serializeJobMetadata(validInput)))).toEqual(validInput);
expect(() => parseJobMetadata({ schema: "wrong" })).toThrow("Unsupported job metadata");
```

Cover all exact field limits from the design.

- [ ] **Step 2: Write failing role/state action tests**

```ts
expect(deriveJobActions(createdJob, client)).toEqual(["fund"]);
expect(deriveJobActions(fundedJob, stranger)).toEqual(["accept"]);
expect(deriveJobActions(inProgressPendingJob, worker)).toEqual(["submit-proof"]);
expect(deriveJobActions(inProgressSubmittedJob, client)).toEqual(["confirm"]);
expect(deriveJobActions(inProgressPendingJob, stranger)).toEqual([]);
```

- [ ] **Step 3: Run and verify RED**

Run: `pnpm --filter @giglock/frontend test -- src/features/jobs/model.test.ts`  
Expected: FAIL because the model is missing.

- [ ] **Step 4: Implement pure model**

Use `parseUnits(value, 6)` only after a strict decimal regex and explicit
positive check. Parse unknown JSON with manual type guards; do not cast unknown
objects directly. Model Solidity enums as named numeric constants.

- [ ] **Step 5: Run and verify GREEN**

Run: `pnpm --filter @giglock/frontend test -- src/features/jobs/model.test.ts`  
Expected: all domain tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/features/jobs/model.ts packages/frontend/src/features/jobs/model.test.ts
git commit -m "feat(frontend): add job metadata and action domain"
```

### Task 4: IPFS metadata and evidence client

**Files:**
- Create: `packages/frontend/src/features/jobs/ipfs.ts`
- Create: `packages/frontend/src/features/jobs/ipfs.test.ts`
- Reuse: `packages/frontend/src/lib/ipfs.ts`

**Interfaces:**
- Produces:
  - `uploadJobMetadata(metadata): Promise<PinResult>`
  - `uploadEvidence(file): Promise<{ pin: PinResult; proofHash: Hex }>`
  - `fetchJobMetadata(cid, fetcher?): Promise<JobMetadataV1>`
  - `ipfsUrl(cid): string`

- [ ] **Step 1: Write failing transport-boundary tests**

Stub `fetch` and assert metadata is uploaded as
`application/json` with filename `giglock-job.json`. Assert evidence returns
the Filebase CID and Keccak-256 hash. Assert metadata responses over 1 MiB,
non-JSON responses, and wrong schemas reject.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @giglock/frontend test -- src/features/jobs/ipfs.test.ts`  
Expected: FAIL because `ipfs.ts` is missing.

- [ ] **Step 3: Implement the IPFS client**

Create a JSON `File`, call the existing multipart helper, derive gateway URLs
only from configured gateway + encoded CID, and enforce a one-megabyte metadata
response limit before parsing.

- [ ] **Step 4: Run and verify GREEN**

Run: `pnpm --filter @giglock/frontend test -- src/features/jobs/ipfs.test.ts`  
Expected: all IPFS tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/features/jobs/ipfs.ts packages/frontend/src/features/jobs/ipfs.test.ts packages/frontend/src/lib/ipfs.ts
git commit -m "feat(frontend): add IPFS job metadata and evidence client"
```

### Task 5: Chain queries and transaction workflows

**Files:**
- Create: `packages/frontend/src/features/jobs/queries.ts`
- Create: `packages/frontend/src/features/jobs/transactions.ts`
- Create: `packages/frontend/src/features/jobs/transactions.test.ts`

**Interfaces:**
- Produces query keys `jobsKeys.all`, `jobsKeys.detail(address)`,
  `jobsKeys.balances(account)`.
- Produces loaders `loadAllJobs`, `loadJob`, `loadWorkerJobs`.
- Produces workflow reducers for `claim`, `create`, `approve`, `fund`, `accept`,
  `submit-proof`, and `confirm`.

- [ ] **Step 1: Write failing workflow recovery tests**

```ts
expect(nextCreateStep({ metadataCid: "bafy", jobAddress: undefined, allowance: 0n }, 5n)).toBe("create");
expect(nextCreateStep({ metadataCid: "bafy", jobAddress: job, allowance: 0n }, 5n)).toBe("approve");
expect(nextCreateStep({ metadataCid: "bafy", jobAddress: job, allowance: 5n }, 5n)).toBe("fund");
```

Test receipt log decoding of `JobCreated`, exact invalidation keys, and no
automatic return to `create` after a job address exists.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @giglock/frontend test -- src/features/jobs/transactions.test.ts`  
Expected: FAIL because transaction workflow functions are missing.

- [ ] **Step 3: Implement reads**

Read factory job addresses, batch `status/client/worker/totalAmount/metadataCid/
milestoneCount`, read milestone tuples, fetch metadata independently, and
return partial snapshots when metadata is unavailable.

- [ ] **Step 4: Implement receipt-backed write helpers**

Use wagmi `writeContract` from components/hooks and viem receipt decoding.
Never advance a dependent workflow stage before a successful receipt.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm --filter @giglock/frontend test -- src/features/jobs
pnpm --filter @giglock/frontend typecheck
```

Expected: all job tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/features/jobs/queries.ts packages/frontend/src/features/jobs/transactions.ts packages/frontend/src/features/jobs/transactions.test.ts
git commit -m "feat(frontend): add job chain data and workflows"
```

### Task 6: dApp dashboard and faucet

**Files:**
- Create: `packages/frontend/src/pages/AppDashboardPage.tsx`
- Create: `packages/frontend/src/features/jobs/components/WalletGate.tsx`
- Create: `packages/frontend/src/features/jobs/components/BalanceCard.tsx`
- Create: `packages/frontend/src/features/jobs/components/JobCard.tsx`
- Create: `packages/frontend/src/features/jobs/components/JobStatusBadge.tsx`
- Create: `packages/frontend/src/features/jobs/components/TransactionProgress.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Interfaces:**
- Consumes Task 5 query keys/loaders.
- Produces `/app` with available/client/worker tabs and faucet action.

- [ ] **Step 1: Install component-test tools**

Run:

```bash
pnpm --filter @giglock/frontend add -D @testing-library/react @testing-library/user-event jsdom
```

- [ ] **Step 2: Write failing dashboard component tests**

Test disconnected wallet prompt, wrong-network switch action, zero-state tabs,
faucet pending/confirmed states, and that funded unassigned jobs appear under
Available.

- [ ] **Step 3: Run and verify RED**

Run: `pnpm --filter @giglock/frontend test -- src/features/jobs/components`  
Expected: FAIL before components exist.

- [ ] **Step 4: Implement dashboard/components**

Keep read-only lists visible while disconnected. Require wallet/network only
for writes. Faucet calls `claim()`, waits for receipt, then invalidates balance
queries.

- [ ] **Step 5: Run component tests and build**

Run:

```bash
pnpm --filter @giglock/frontend test
pnpm --filter @giglock/frontend build
```

Expected: all frontend tests pass and production build exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/pages/AppDashboardPage.tsx packages/frontend/src/features/jobs/components packages/frontend/package.json pnpm-lock.yaml
git commit -m "feat(frontend): add job dashboard and testnet faucet"
```

### Task 7: Create, approve, and fund job route

**Files:**
- Create: `packages/frontend/src/pages/NewJobPage.tsx`
- Create: `packages/frontend/src/features/jobs/components/MilestoneEditor.tsx`
- Create: `packages/frontend/src/features/jobs/components/CreateJobProgress.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Interfaces:**
- Consumes metadata/IPFS client and create workflow.
- Produces `/app/jobs/new`.

- [ ] **Step 1: Write failing form/workflow tests**

Test add/remove milestone limits, exact total, validation messages, upload
retry preserving fields, create receipt routing, approval recovery, and funding
completion.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @giglock/frontend test -- src/pages/NewJobPage.test.tsx`  
Expected: FAIL before page exists.

- [ ] **Step 3: Implement the resumable form**

Pin metadata once per unchanged form payload. Decode the new job address from
`JobCreated`. Persist confirmed `metadataCid` and `jobAddress` in navigation
state plus chain-derived recovery; never re-create after `jobAddress` exists.

- [ ] **Step 4: Run tests and build**

Run:

```bash
pnpm --filter @giglock/frontend test -- src/pages/NewJobPage.test.tsx
pnpm --filter @giglock/frontend build
```

Expected: tests and build pass.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/pages/NewJobPage.tsx packages/frontend/src/pages/NewJobPage.test.tsx packages/frontend/src/features/jobs/components/MilestoneEditor.tsx packages/frontend/src/features/jobs/components/CreateJobProgress.tsx
git commit -m "feat(frontend): add create and fund job workflow"
```

### Task 8: Job detail, acceptance, evidence, and release

**Files:**
- Create: `packages/frontend/src/pages/JobDetailPage.tsx`
- Create: `packages/frontend/src/pages/JobDetailPage.test.tsx`
- Create: `packages/frontend/src/features/jobs/components/MilestoneTimeline.tsx`
- Create: `packages/frontend/src/features/jobs/components/EvidencePanel.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Interfaces:**
- Consumes Task 5 job snapshot/actions and Task 4 evidence client.
- Produces `/app/jobs/:address` and the second-wallet happy path.

- [ ] **Step 1: Write failing action-visibility tests**

Test client-created funding action, stranger-funded accept action,
worker-pending evidence action, client-submitted confirm action, evidence link,
and no active buttons for irrelevant wallets.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @giglock/frontend test -- src/pages/JobDetailPage.test.tsx`  
Expected: FAIL before page exists.

- [ ] **Step 3: Implement detail and action panels**

Render on-chain data even when metadata fails. Evidence submission hashes and
uploads before the wallet write. Confirmation shows CID, gateway link, and hash
before enabling release.

- [ ] **Step 4: Run tests and build**

Run:

```bash
pnpm --filter @giglock/frontend test
pnpm --filter @giglock/frontend build
```

Expected: all frontend tests and build pass.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/pages/JobDetailPage.tsx packages/frontend/src/pages/JobDetailPage.test.tsx packages/frontend/src/features/jobs/components/MilestoneTimeline.tsx packages/frontend/src/features/jobs/components/EvidencePanel.tsx
git commit -m "feat(frontend): add worker proof and client release flow"
```

### Task 9: Deploy revised contracts and update configuration

**Files:**
- Modify: `packages/shared/src/addresses.ts`
- Modify: `packages/frontend/src/features/protocolMetrics/query.ts`
- Add: `packages/contracts/ignition/deployments/chain-91342/**`
- Modify: `docs/DEPLOY.md`

**Interfaces:**
- Consumes tested revised contracts.
- Produces live addresses and scan block for the completed frontend.

- [ ] **Step 1: Run predeployment verification**

Run:

```bash
pnpm --filter @giglock/contracts test
pnpm --filter @giglock/shared build
pnpm --filter @giglock/frontend test
pnpm --filter @giglock/frontend build
```

Expected: zero failures.

- [ ] **Step 2: Check deployer without exposing its key**

Load the ignored `packages/contracts/.env`, validate only the key shape, derive
and print only the public address, confirm chain ID `91342`, and verify a
non-zero balance.

- [ ] **Step 3: Deploy with Ignition**

Run:

```bash
pnpm --filter @giglock/contracts run deploy:giwa-testnet
```

Confirm only the GIWA Sepolia prompt. Record the new addresses and JobFactory
deployment block from the journal.

- [ ] **Step 4: Update registry, dashboard block, and docs**

Replace all five GIWA Sepolia addresses, the dashboard start block, explorer
links, and deployment records. Keep `minimalForwarder` at the zero address.

- [ ] **Step 5: Verify live bytecode and wiring**

Query bytecode at all addresses; read JobFactory token/registry/arbiter; read
registry factory; verify they match the recorded addresses.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/addresses.ts packages/frontend/src/features/protocolMetrics/query.ts packages/contracts/ignition/deployments/chain-91342 docs/DEPLOY.md
git commit -m "chore: record CID-aware GIWA Sepolia deployment"
```

### Task 10: Final acceptance and PR

**Files:**
- Verify the complete branch.

**Interfaces:**
- Produces a reviewed PR targeting `main`.

- [ ] **Step 1: Run full verification**

Run:

```bash
pnpm test
pnpm build
pnpm typecheck
git diff --check origin/main...HEAD
```

Expected: all commands exit 0; existing bundle-size warnings may remain.

- [ ] **Step 2: Run live IPFS smoke test**

Upload a tiny non-sensitive text file, confirm a CID is returned, fetch it from
the configured gateway, and verify its bytes.

- [ ] **Step 3: Run live two-wallet acceptance**

Complete claim → create → approve → fund → accept → upload → submit → confirm.
Record public transaction hashes only and verify exact worker payment.

- [ ] **Step 4: Secret and scope audit**

Confirm ignored `.env` files remain untracked and search tracked text files for
private-key/Filebase-secret assignments. Review the diff against every success
criterion in the approved spec.

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin feature/dapp-happy-path
gh pr create --base main --head feature/dapp-happy-path
```

Preserve the worktree for review feedback.
