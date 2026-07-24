# Live Protocol Metrics Design

**Date:** 2026-07-24  
**Status:** Approved design  
**Target:** GigLock frontend on GIWA Sepolia

## Objective

Replace the hard-coded homepage statistics with metrics calculated from the deployed GigLock contracts on GIWA Sepolia. The UI must distinguish loading, genuine zero activity, insufficient history, and RPC failure. It must never present the previous fixture values as live data.

## Deployed contracts

| Contract | Address |
|---|---|
| JobFactory | `0x34Cb4E2D1791fC1eD51F4DEf4171129903976113` |
| MockUSDC | `0xE85931C270e358b182e64eE83d00524658a375Cf` |
| MockUSDCFaucet | `0x10CfE424F4c7079aD5346F55c96723aBC4aeC50f` |
| ReputationRegistry | `0xfA172Bd33BdDD43CDe5436184b65A5586C7387dF` |
| Arbiter | `0xF9404775587261aD5eA698bc9A1496C39E2Df3c5` |

The shared address registry is the source of truth for frontend contract addresses. `minimalForwarder` remains the zero address because the current Ignition module does not deploy one.

## Metric definitions

### Total value locked

TVL is the sum of current MockUSDC balances held by escrow contracts created by JobFactory. Values use the token's six decimals and are displayed in USDC.

“Locked across N jobs” counts escrow contracts whose current MockUSDC balance is greater than zero.

### Total transactions

Total transactions counts unique transaction hashes represented by GigLock protocol events. It includes `JobCreated` plus events emitted by every discovered EscrowJob. Multiple protocol events in one transaction count once.

It does not include unrelated GIWA Chain transactions, token transfers without a GigLock protocol event, deployment transactions, or read-only calls.

### Active escrow jobs

A job is active when its on-chain `status()` is `Funded` or `InProgress`. Created, Completed, and Cancelled jobs are not active.

The donut percentage is `active jobs / total created jobs * 100`, rounded to the nearest integer. When no jobs exist, the percentage is zero.

### Average payment time

Payment time is the elapsed block timestamp between a `MilestoneSubmitted` event and the matching `MilestoneReleased` event for the same escrow and milestone ID.

The average is computed across released milestones with both events available. When no complete pair exists, the UI displays an em dash rather than zero seconds.

### Trends and sparklines

The current period is the most recent seven complete or partial UTC days, including today. The comparison period is the preceding seven UTC days.

Transaction trend is based on daily unique protocol transaction counts. TVL trend is not reconstructed because current token balances do not provide reliable historical TVL without an indexer. The TVL card therefore shows its current value without a percentage until historical indexing exists.

Active-job trend is not shown because contract status reads describe only the present state. Average payment-time trend is not shown until at least one completed payment exists in both periods.

The transaction sparkline contains seven daily counts. It remains valid when all values are zero.

## Architecture

### Chain client

The frontend will create a public viem client from the selected chain and `VITE_GIWA_RPC_URL`. Wallet connection is not required to read metrics.

### Data source

The metrics loader will:

1. Resolve JobFactory and MockUSDC from `addressesByChain`.
2. Reject zero or missing addresses as an unavailable configuration.
3. read `JobCreated` logs from the deployment start block to the latest block;
4. deduplicate discovered escrow addresses;
5. batch contract reads for each escrow's status and MockUSDC balance;
6. fetch escrow protocol logs for the discovered addresses;
7. fetch timestamps only for blocks needed by payment pairs and daily transaction buckets;
8. calculate a serializable metrics result through pure aggregation functions.

The deployment start block will be stored alongside the frontend metrics configuration so the browser never scans from genesis.

### Query lifecycle

React Query will own loading, caching, refetching, and errors. Metrics will have a short stale time and periodically refetch while the page is open. The previous successful result may remain visible during a background refresh.

Direct RPC reads are appropriate for the new testnet deployment. When protocol volume makes browser-side log aggregation too expensive, the pure aggregation contract can be retained while the loader is replaced by an indexed API.

## UI behavior

- Initial load: preserve card dimensions and show skeleton values.
- Genuine empty protocol: show `$0.00`, `0`, `0`, and `—` for average payment time.
- RPC/configuration failure: show `Unavailable` and a compact retry control or explanatory status.
- Background refresh: retain the last successful values without flashing skeletons.
- Trend unavailable: omit the arrow and percentage instead of displaying a fabricated value.
- Footer and card attribution continue to say “Powered by GIWA Chain.”

## Error handling

The loader returns no partial fabricated metrics. A failed required RPC read places the query in an error state. Individual missing event pairs are ignored for average-payment calculations because a release cannot be timed without a submission.

RPC range limitations will be handled by querying logs in bounded block chunks. The chunk size will be a named configuration value so it can be adjusted without changing metric semantics.

## Testing

Tests will be written before implementation for pure aggregation behavior:

- unique protocol transaction counting;
- active status classification and zero-job percentage;
- USDC balance summation and positive-balance job counting;
- matching milestone submission/release pairs;
- ignoring incomplete payment pairs;
- seven-day transaction bucketing and comparison;
- empty protocol results;
- formatting genuine zeros versus unavailable values.

The frontend production build and existing contract tests will be rerun after implementation. Live verification will confirm the loader can read the deployed JobFactory and return the current empty-protocol state from GIWA Sepolia.

## Documentation updates

`docs/DEPLOY.md` will be updated to:

- record the deployed GIWA Sepolia addresses and explorer links;
- document that the current module assigns arbiter admin to the deployer;
- remove the misleading implication that `ARBITER_ADMIN_ADDRESS` changes deployment behavior;
- state that `minimalForwarder` is not deployed;
- state that automated Blockscout verification is not configured;
- explain the Vercel environment values and redeployment step;
- define each live homepage metric and its empty/error behavior.

## Out of scope

- GIWA mainnet deployment;
- a persistent analytics database or indexer;
- historical TVL reconstruction;
- deploying `MinimalForwarder`;
- contract source verification automation;
- fabricating demo activity or retaining fixture statistics.
