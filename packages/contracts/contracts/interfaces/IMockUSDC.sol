// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IMockUSDC
/// @notice Minimal mock stablecoin interface for the GigLock MVP.
interface IMockUSDC {
    function mint(address to, uint256 amount) external;
    function faucetClaim(address claimant) external returns (uint256);
}