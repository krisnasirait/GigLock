// AUTO-GENERATED — do not edit. Regenerate via: pnpm --filter @giglock/shared run generate-abis
export const IReputationRegistryEscrowAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "onTime",
        "type": "bool"
      }
    ],
    "name": "recordCompletion",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "loser",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "winner",
        "type": "address"
      }
    ],
    "name": "recordDisputeOutcome",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "raiser",
        "type": "address"
      }
    ],
    "name": "recordDisputeRaised",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint8",
        "name": "score",
        "type": "uint8"
      }
    ],
    "name": "recordRating",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
export default IReputationRegistryEscrowAbi;
