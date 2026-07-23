// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IMockUSDC.sol";

/// @title MockUSDCFaucet
/// @notice Claims 1000 USDC per address per 24h. Ownable so an admin can
///         reclaim if anything goes wrong, but in MVP it has no admin-only
///         setters — the constants are good enough for the demo.
contract MockUSDCFaucet is Ownable {
    IMockUSDC public immutable token;
    uint256 public constant CLAIM_AMOUNT = 1_000 * 10 ** 6; // 1000 USDC, 6 decimals
    uint256 public constant COOLDOWN = 24 hours;

    mapping(address => uint256) public lastClaimedAt;

    event Claimed(address indexed claimant, uint256 amount, uint256 nextClaimAt);

    constructor(address _token, address initialOwner) Ownable(initialOwner) {
        token = IMockUSDC(_token);
    }

    function claim() external {
        uint256 last = lastClaimedAt[msg.sender];
        require(block.timestamp >= last + COOLDOWN, "faucet: wait 24h between claims");
        lastClaimedAt[msg.sender] = block.timestamp;
        token.mint(msg.sender, CLAIM_AMOUNT);
        emit Claimed(msg.sender, CLAIM_AMOUNT, block.timestamp + COOLDOWN);
    }
}