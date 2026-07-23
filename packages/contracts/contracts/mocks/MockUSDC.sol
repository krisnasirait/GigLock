// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice 6-decimal mock stablecoin for GigLock MVP. Inherits Ownable so the
///         contract has a canonical owner address (used by the Faucet, which
///         keeps rate-limiting concerns out of the token itself), but `mint`
///         is intentionally permissionless — the Faucet is the only caller in
///         practice. This avoids the chicken-and-egg ownership wiring you'd
///         otherwise need between MockUSDC and MockUSDCFaucet.
contract MockUSDC is ERC20, Ownable {
    constructor(address initialOwner) ERC20("MockUSDC", "USDC") Ownable(initialOwner) {}

    /// @notice Real USDC has 6 decimals; OZ's default is 18.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}