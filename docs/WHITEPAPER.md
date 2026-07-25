# 🔒 GigLock Protocol: Technical Whitepaper & Architecture Specification

**Version:** 1.0.0  
**Network:** GIWA Sepolia (Chain ID: `91342`)  
**License:** MIT  
**Explorer:** [sepolia-explorer.giwa.io](https://sepolia-explorer.giwa.io)  
**dApp Application:** [gig-lock-frontend.vercel.app](https://gig-lock-frontend.vercel.app/app)  

---

## 🎯 EXECUTIVE SUMMARY & ABSTRACT

The global freelance and gig economy processes over **$1.5 Trillion** in annual transaction volume, yet freelancers and clients face persistent structural friction: **payment delays, high intermediary fees (10-20%), platform lock-in, and arbitrary centralized dispute outcomes**. 

**GigLock** is a decentralized, non-custodial milestone escrow protocol built on the **GIWA EVM Layer 2 network**. GigLock replaces centralized escrow middlemen with immutable smart contract state machines, cryptographic deliverable verification via **IPFS + Keccak-256 hashing**, and portable Web3 identity anchored by **GIWA ID (Dojang Attestation)**.

### Key Value Innovations:
1. **Zero-Trust Milestone Escrow**: Funds are locked on-chain in isolated escrow contracts. Payment releases are programmatically triggered by receipt-confirmed client approvals.
2. **Cryptographic Delivery Evidence**: Workers pin deliverables to IPFS; the exact raw-byte Keccak-256 hash is committed to the blockchain, creating an immutable audit trail.
3. **Sybil-Resistant GIWA ID Reputation**: On-chain completion records are tied to Dojang identity attestations (e.g., Upbit verification), allowing workers to own their global Web3 reputation.
4. **Instant Low-Cost Settlement**: Built on GIWA Sepolia with 0.4s block finality and near-zero gas costs.

---

## 🏗️ SYSTEM ARCHITECTURE & PROTOCOL DESIGN

GigLock employs a modular **Factory-Instance Smart Contract Architecture** engineered for isolation, gas efficiency, and upgrade independence.

```
                         ┌─────────────────────────────────┐
                         │         JobFactory.sol          │
                         │   (0xb01f...DDFF on Chain 91342)│
                         └────────────────┬────────────────┘
                                          │
                  Creates Lightweight EscrowJob Instances
                                          │
       ┌──────────────────────────────────┼──────────────────────────────────┐
       ▼                                  ▼                                  ▼
┌───────────────┐                  ┌───────────────┐                  ┌───────────────┐
│ EscrowJob #1  │                  │ EscrowJob #2  │                  │ EscrowJob #N  │
│  (0xD39b...)  │                  │  (0x71A4...)  │                  │  (0x94EF...)  │
└──────┬────────┘                  └──────┬────────┘                  └──────┬────────┘
       │                                  │                                  │
       ▼                                  ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            ReputationRegistry.sol                                   │
│                 (Tracks Verified Worker Scores & Completion Records)               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. `JobFactory.sol`
The core factory contract responsible for instantiating new escrow agreements.
- **Factory Deployment Address**: [`0xb01fDC7B8df1A5E4f7F843046f734C6fD622DDFF`](https://sepolia-explorer.giwa.io/address/0xb01fDC7B8df1A5E4f7F843046f734C6fD622DDFF#code)
- **Role**: Validates milestone amounts, deploys minimal `EscrowJob` contracts, links `ReputationRegistry` and `Arbiter`, and emits indexable `JobCreated` events.

### 2. `EscrowJob.sol`
The autonomous state machine governing an individual gig agreement.
- **Milestone Structure**: Each job supports 1 to 10 independent release-ready milestones.
- **Token Support**: Native support for 6-decimal ERC-20 stablecoins (MockUSDC on GIWA Sepolia).
- **Zero Custody**: Escrow contracts hold exact funds until milestone confirmation or dispute resolution. Neither the factory owner nor arbiters can withdraw funds outside the consensus rules.

### 3. `ReputationRegistry.sol`
Anchors portable worker identity and performance metrics.
- **Registry Address**: [`0xE8BCF79C93d40565DdCFaAE4bA3d9a24C7dC8B6E`](https://sepolia-explorer.giwa.io/address/0xE8BCF79C93d40565DdCFaAE4bA3d9a24C7dC8B6E#code)
- **Dojang Verification**: Integrates with Dojang Attestation (Upbit Attester ID `0xd99b42e778498aa3c...`) to prevent Sybil reputation manipulation.
- **Metrics Tracked**: Successful Job Completions, Disputed Resolutions, On-time Releases, and Lifetime Volume.

### 4. `Arbiter.sol`
The dispute resolution protocol.
- **Arbiter Address**: [`0xEC61bf4e000B72B8a4f94556B608e03673Df629E`](https://sepolia-explorer.giwa.io/address/0xEC61bf4e000B72B8a4f94556B608e03673Df629E#code)
- **Mechanism**: In the event of an unresolvable conflict, either party can trigger a dispute. The designated Arbiter reviews IPFS evidence and issues an on-chain ruling (`ReleaseToWorker` or `RefundToClient`).

---

## 🔄 ESCROW STATE MACHINE & MILESTONE LIFECYCLE

Every `EscrowJob` follows a strict deterministic state transition graph:

```
    [ 0: Created ]  ──( Client Funds Job )──>  [ 1: Funded ]
                                                    │
                                           ( Worker Accepts Job )
                                                    │
                                                    ▼
                                            [ 2: InProgress ]
                                                    │
                                        ( Worker Submits Deliverable )
                                                    │
                                                    ▼
                                            [ 3: Submitted ]
                                                    │
                    ┌───────────────────────────────┴───────────────────────────────┐
                    │                                                               │
        ( Client Approves Proof )                                      ( Dispute Triggered )
                    │                                                               │
                    ▼                                                               ▼
           [ 4: Completed / Released ]                                     [ 5: Disputed ]
                                                                                    │
                                                                         ( Arbiter Rulings )
                                                                                    │
                                                                   ┌────────────────┴────────────────┐
                                                                   ▼                                 ▼
                                                        [ Released to Worker ]             [ Refunded to Client ]
```

### Milestone State Definitions:
- **`0: Pending`**: Milestone is defined and awaiting deliverable submission.
- **`1: Submitted`**: Worker uploaded deliverable to IPFS. Exact CID and Keccak-256 hash committed on-chain.
- **`2: Confirmed`**: Client reviewed evidence and approved fund release.
- **`3: Disputed`**: Either party opened a formal dispute for arbiter review.
- **`4: Released`**: Stablecoin funds transferred from escrow to worker wallet.
- **`5: Refunded`**: Escrow funds returned to client wallet following dispute ruling.

---

## 📦 DATA & EVIDENCE SPECIFICATION (`JobMetadataV1`)

GigLock balances on-chain immutability with storage cost optimization by separating metadata into two tiers:

### 1. On-Chain Data (Execution Critical)
Stored directly in smart contract state for 100% execution guarantees:
- Client Address & Worker Address (`address`)
- Milestone Amounts in 6-decimal USDC (`uint256[]`)
- Milestone Statuses (`uint8[]`)
- IPFS CIDs for Brief and Deliverables (`string`)
- Raw Deliverable Keccak-256 Hashes (`bytes32`)

### 2. Off-Chain IPFS Metadata Schema (`JobMetadataV1`)
Stored on IPFS and pinned via Pinata / Web3.Storage:

```json
{
  "version": "1.0.0",
  "title": "ERC-721 Smart Contract and Minting DApp",
  "description": "Develop and deploy an ERC-721A contract on Sepolia with a React frontend.",
  "skills": ["Solidity", "React", "Ethers.js", "ERC-721", "Hardhat"],
  "milestones": [
    {
      "title": "Concept Sketch & Layout Structure",
      "description": "Initial architecture proposal and design mockups.",
      "amountUsdc": "15"
    },
    {
      "title": "Final Delivery & Source Files",
      "description": "Production Solidity contracts, test suite, and frontend integration.",
      "amountUsdc": "35"
    }
  ]
}
```

---

## 🔒 SECURITY & SMART CONTRACT AUDITING

GigLock smart contracts are built to strict institutional Web3 security standards:

1. **Reentrancy Protection**: All state modifications follow the Checks-Effects-Interactions (CEI) pattern and leverage OpenZeppelin `ReentrancyGuard`.
2. **Zero-Privilege Escrows**: Individual escrow contracts hold strictly the funds deposited for that gig. A flaw in one agreement cannot compromise other protocol escrows.
3. **Formal Verification & Bytecode Match**: 100% of deployed contracts on GIWA Sepolia are verified on Blockscout with exact EVM bytecode matches.
4. **Strict Integer Protection**: Built using Solidity `0.8.24` with native overflow/underflow protection and explicit unit limits (`MAX_MILESTONES = 10`).

---

## 📜 DEPLOYED & VERIFIED CONTRACT DIRECTORY

All smart contracts are live on **GIWA Sepolia (Chain ID: `91342`)**:

| Contract Name | Verified Contract Address | Explorer Link |
| :--- | :--- | :--- |
| **JobFactory** | `0xb01fDC7B8df1A5E4f7F843046f734C6fD622DDFF` | [View Verified Source](https://sepolia-explorer.giwa.io/address/0xb01fDC7B8df1A5E4f7F843046f734C6fD622DDFF#code) |
| **MockUSDC (Payment Token)** | `0xf5d40D37cA17eC7e5a2e4Ae170e4deF0e57B99eb` | [View Verified Source](https://sepolia-explorer.giwa.io/address/0xf5d40D37cA17eC7e5a2e4Ae170e4deF0e57B99eb#code) |
| **MockUSDC Faucet** | `0xc04f1831C8821a5eff267c6cB4D7e6ba847b5A9b` | [View Verified Source](https://sepolia-explorer.giwa.io/address/0xc04f1831C8821a5eff267c6cB4D7e6ba847b5A9b#code) |
| **ReputationRegistry** | `0xE8BCF79C93d40565DdCFaAE4bA3d9a24C7dC8B6E` | [View Verified Source](https://sepolia-explorer.giwa.io/address/0xE8BCF79C93d40565DdCFaAE4bA3d9a24C7dC8B6E#code) |
| **Arbiter Escrow** | `0xEC61bf4e000B72B8a4f94556B608e03673Df629E` | [View Verified Source](https://sepolia-explorer.giwa.io/address/0xEC61bf4e000B72B8a4f94556B608e03673Df629E#code) |

---

## 💻 DEVELOPER INTEGRATION GUIDE

Integrating with GigLock protocol using `viem` or `ethers.js`:

### 1. Create a New Escrow Agreement
```typescript
import { publicClient, walletClient } from './wagmi';
import { JobFactoryAbi, GIWA_SEPOLIA_ADDRESSES } from '@giglock/shared';
import { parseUnits } from 'viem';

// Define milestones: 15 USDC and 35 USDC
const milestoneAmounts = [parseUnits('15', 6), parseUnits('35', 6)];
const ipfsMetadataCid = "QmPCBzaw62LmsAwHZguwSAx7mqsWVJxyJwt92VQ4zRy3AW";

const hash = await walletClient.writeContract({
  address: GIWA_SEPOLIA_ADDRESSES.jobFactory,
  abi: JobFactoryAbi,
  functionName: 'createJob',
  args: [milestoneAmounts, ipfsMetadataCid],
});

console.log("Job Creation Transaction Hash:", hash);
```

### 2. Submit Deliverable Evidence (Worker)
```typescript
import { EscrowJobAbi } from '@giglock/shared';

// submitMilestone(milestoneId, keccak256Hash, ipfsCid)
const tx = await walletClient.writeContract({
  address: escrowJobAddress,
  abi: EscrowJobAbi,
  functionName: 'submitMilestone',
  args: [
    0n, // Milestone index 0
    '0xbbfa476b5f50f4f09b5c1a9670c1f9b67fb2ed82e9bbae65264894745e53b17d', // Keccak256
    'QmZSxBRV6aV8dkJdThtK9TYj14eQ858XKU99ea7dXKJUUd' // Deliverable IPFS CID
  ],
});
```

---

## 🌐 COMMUNITY & LINKS

- **dApp Dashboard**: [https://gig-lock-frontend.vercel.app/app](https://gig-lock-frontend.vercel.app/app)
- **GitHub Repository**: [https://github.com/krisnasirait/GigLock](https://github.com/krisnasirait/GigLock)
- **GIWA Explorer**: [https://sepolia-explorer.giwa.io](https://sepolia-explorer.giwa.io)
