// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title EscrowJob (stub — full state machine comes in Task 4)
/// @notice Stub exposes only the constructor that JobFactory needs.
contract EscrowJob {
    address public immutable client;
    address public immutable token;
    address public immutable reputationRegistry;
    address public immutable arbiter;

    constructor(
        address _client,
        address _token,
        address _registry,
        address _arbiter,
        uint256[] memory milestoneAmounts
    ) {
        require(milestoneAmounts.length > 0, "no milestones");
        client = _client;
        token = _token;
        reputationRegistry = _registry;
        arbiter = _arbiter;
    }
}
