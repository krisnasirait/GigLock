# GigLock dApp Happy-Path Design

**Date:** 2026-07-24  
**Status:** Approved design  
**Target:** GIWA Sepolia testnet

## Objective

Build the first complete, usable GigLock workflow using direct wallet
transactions:

1. a client claims MockUSDC;
2. the client uploads job metadata to IPFS;
3. the client creates, approves, and funds an escrow;
4. a worker accepts the job;
5. the worker uploads milestone evidence to IPFS;
6. the worker submits the evidence CID and hash on-chain;
7. the client reviews the evidence and releases payment.

The result must work across two independent wallets and browsers. Job metadata
and proof locations must be reconstructable from chain state without relying on
local storage.

## Scope and delivery sequence

This design covers one end-to-end milestone rather than the entire eventual
product.

Included:

- contract support for job metadata CIDs and proof CIDs;
- a fresh GIWA Sepolia contract deployment;
- faucet and balance UI;
- create, approve, fund, list, inspect, accept, submit, and confirm actions;
- IPFS metadata and evidence uploads through the deployed relayer;
- role- and state-aware actions;
- transaction progress, errors, receipts, and explorer links;
- automatic invalidation of job lists, balances, details, and homepage metrics.

Deferred:

- dispute creation and arbiter resolution UI;
- timeout-claim UI;
- ratings and reputation UI;
- sponsored transactions and `MinimalForwarder`;
- upload authentication and production-grade rate limiting;
- mainnet deployment;
- contract upgrades or migration tooling.

## Contract design

### EscrowJob

Add a job-level metadata field:

```solidity
string public metadataCid;
```

The constructor becomes:

```solidity
constructor(
    address _client,
    address _token,
    address _reputationRegistry,
    address _arbiter,
    uint256[] memory milestoneAmounts,
    string memory _metadataCid
)
```

It rejects:

- an empty metadata CID;
- a metadata CID longer than 128 bytes.

Each `Milestone` keeps the existing `bytes32 proofHash` and adds:

```solidity
string proofCid;
```

`submitMilestone` becomes:

```solidity
function submitMilestone(
    uint256 milestoneId,
    bytes32 proofHash,
    string calldata proofCid
) external onlyWorker
```

It rejects:

- an empty proof CID;
- a proof CID longer than 128 bytes;
- a zero proof hash.

`MilestoneSubmitted` includes the proof CID:

```solidity
event MilestoneSubmitted(
    uint256 indexed milestoneId,
    bytes32 proofHash,
    string proofCid,
    uint256 deadline
);
```

The existing state machine, token transfers, confirmation window, and dispute
logic remain unchanged.

### JobFactory

`createJob` becomes:

```solidity
function createJob(
    uint256[] calldata milestoneAmounts,
    string calldata metadataCid
) external returns (address)
```

The factory passes the CID to the new escrow constructor. `JobCreated` also
includes the CID so indexers can discover it without an additional contract
read:

```solidity
event JobCreated(
    address indexed jobContract,
    address indexed client,
    uint256 totalAmount,
    string metadataCid
);
```

### Deployment

The change is ABI-incompatible, so the complete Ignition module will deploy a
fresh MockUSDC, faucet, Arbiter, ReputationRegistry, and JobFactory. The
currently deployed factory contains no jobs, so there is no user-state
migration.

After deployment:

- update `packages/shared/src/addresses.ts`;
- update the dashboard scan start block;
- commit the new Ignition deployment records;
- update `docs/DEPLOY.md`;
- update Vercel only if environment values change;
- verify runtime bytecode and contract wiring before using the UI.

## IPFS data design

### Job metadata document

The frontend generates and pins a versioned JSON file:

```ts
type JobMetadataV1 = {
  schema: "giglock/job@1";
  title: string;
  description: string;
  skills: string[];
  createdAt: string;
  milestones: Array<{
    title: string;
    description: string;
    amountUsdc: string;
  }>;
};
```

Validation limits:

- title: 3–100 characters;
- description: 10–4,000 characters;
- skills: at most 10, each 1–32 characters;
- milestones: 1–10;
- milestone title: 3–100 characters;
- milestone description: at most 1,000 characters;
- amount: greater than zero with no more than six decimals;
- total amount: must fit `uint256`.

The client’s wallet address is not duplicated in metadata because it is already
authoritative on-chain.

### Milestone evidence

The worker uploads one file, up to the relayer’s configured 10 MiB limit. The
frontend:

1. hashes the raw bytes with Keccak-256;
2. pins the file through `POST /ipfs/pin`;
3. submits both the hash and returned CID;
4. displays the gateway URL and on-chain fingerprint to the client.

The CID locates the evidence. The hash lets the client verify that downloaded
bytes match the submitted file.

### Gateway behavior

The UI derives URLs through the configured IPFS gateway and never trusts a URL
embedded in user metadata. Metadata parsing uses the schema discriminator and
rejects malformed or oversized content.

The current upload route is public and unauthenticated. This is acceptable only
for the controlled testnet milestone. The UI communicates the 10 MiB limit, and
the Filebase bucket is dedicated to testnet. Wallet-signature upload
authorization and server-side rate limiting are required before public or
mainnet use.

## Frontend information architecture

### `/app`

The application dashboard contains:

- wallet connection and GIWA Sepolia network state;
- GIWA ETH and MockUSDC balances;
- a “Claim 1,000 test USDC” action with cooldown handling;
- a primary “Post a job” action;
- tabs for Available, My Client Jobs, and My Worker Jobs;
- job cards with title, total USDC, client, status, and milestone progress;
- honest empty, loading, partial metadata, and RPC failure states.

Available jobs are `Funded` jobs without an accepted worker. Client jobs come
from `getJobsByClient`. Worker jobs are discovered from `JobAccepted` events
filtered by the connected worker.

### `/app/jobs/new`

The form collects:

- title;
- description;
- comma- or token-based skills;
- 1–10 milestone rows with title, description, and USDC amount.

Submission is a resumable three-stage workflow:

1. **Upload metadata** — pin JSON and retain the CID in component/query state.
2. **Create escrow** — call JobFactory and decode `JobCreated` from the receipt.
3. **Fund escrow** — approve exact MockUSDC total, wait for receipt, then call
   `fundJob`.

If creation succeeds but approval or funding fails, the job remains visible in
the client list with a “Finish funding” action. The UI never creates a second
job automatically on retry.

### `/app/jobs/:address`

The job-detail page reads:

- job status, client, worker, token, total amount, and metadata CID;
- every milestone tuple;
- IPFS metadata;
- relevant contract events and transaction hashes.

Actions are derived from wallet role and on-chain state:

- client + Created: approve/fund;
- unassigned non-client + Funded: accept;
- assigned worker + InProgress + Pending milestone: upload/submit evidence;
- client + Submitted milestone: open/verify evidence and confirm/release.

Unavailable actions are not rendered as active buttons. The page explains why
an action is unavailable when that information helps the user switch account or
network.

## Wallet and transaction behavior

- The dApp supports only chain ID `91342`.
- Reads work without a connected wallet.
- Writes require a connected wallet on GIWA Sepolia.
- Network mismatch presents a single switch-network action.
- Every write shows wallet-confirmation, submitted, confirming, success, and
  failure states.
- A receipt is required before the next dependent step begins.
- Successful writes invalidate all affected React Query keys.
- Every submitted transaction links to the GIWA Sepolia explorer.
- User rejection is reported as cancellation, not as a protocol failure.
- Contract reverts are mapped to concise action-specific messages where the
  revert reason is known.

## Data and component boundaries

### Contract data layer

Focused hooks/loaders own chain access:

- protocol configuration and address validation;
- factory job discovery;
- per-job snapshot reads;
- event discovery;
- write-and-wait helpers;
- cache key definitions and invalidation.

Pages consume typed view models rather than decoding raw ABI tuples.

### IPFS data layer

Focused functions own:

- JSON serialization and validation;
- metadata upload;
- evidence upload and hashing;
- gateway fetch with size and schema checks;
- CID-to-gateway URL construction.

### UI components

Reusable units include:

- wallet/network guard;
- balance and faucet card;
- transaction progress panel;
- job status badge;
- job card;
- milestone editor;
- milestone timeline;
- evidence upload/review panel;
- empty and error states.

No single page owns contract decoding, upload transport, formatting, and
presentation simultaneously.

## Error and recovery design

- IPFS upload failure: keep form/file state and allow upload retry.
- Create transaction rejected: retain metadata CID and form values.
- Create succeeds but later step fails: route to the created job and offer
  “Finish funding.”
- Approval succeeds but funding fails: read allowance and skip unnecessary
  reapproval on retry.
- Metadata fetch fails: show on-chain amounts/status with “Metadata
  unavailable.”
- Evidence gateway fails: show CID/hash and offer gateway retry.
- RPC failure: retain last successful React Query data during background
  refresh.
- Wallet account changes: invalidate role-dependent reads and reset pending
  transaction UI that is not tied to a confirmed receipt.
- Duplicate writes: disable the relevant action while its transaction is
  pending or confirming.

## Testing strategy

### Contracts

Write failing tests before contract changes for:

- metadata CID stored on a created escrow;
- empty and overlong metadata CID rejection;
- proof CID and hash stored on submission;
- zero hash, empty CID, and overlong proof CID rejection;
- updated event arguments;
- unchanged create/fund/accept/submit/confirm payment flow.

Run the full contract suite before deployment.

### Frontend

Write failing tests for pure and stateful behavior:

- metadata schema validation and serialization;
- USDC input parsing at six decimals;
- job and milestone tuple normalization;
- role/state action derivation;
- transaction workflow recovery after partial success;
- proof upload hashing and returned CID handling;
- metadata fetch failure fallback;
- query invalidation targets.

Component tests will cover the faucet, job form, transaction progress, job
actions, and empty/error states. Contract calls and IPFS transport are mocked at
the boundary; pure normalization and workflow state are tested without mocks.

### Live testnet acceptance

Use two wallets:

1. client claims test USDC;
2. client creates and funds a multi-milestone job;
3. worker accepts;
4. worker uploads and submits a small evidence file;
5. client opens the evidence and confirms;
6. worker receives the exact milestone amount;
7. homepage metrics and job views reflect the confirmed chain state.

No production or mainnet funds are used.

## Success criteria

- A new user can complete the happy path without using the block explorer.
- A second browser can reconstruct job titles, descriptions, milestones, and
  evidence locations from chain-referenced IPFS data.
- Refreshing or changing routes never loses a successfully created job.
- Partial transaction failures are recoverable without duplicate job creation.
- All displayed balances and statuses are derived from current chain state.
- No private key or Filebase credential enters the frontend bundle or Git.
