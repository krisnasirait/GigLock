// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockDojang
/// @notice Test-only stub matching the DojangScroll interface used by
///         ReputationRegistry. Lets tests control which addresses are
///         "verified" without hitting the live DojangScroll contract.
contract MockDojang {
    mapping(address => bool) private _verified;
    address public immutable realDojangScroll;

    constructor() {
        realDojangScroll = 0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9;
    }

    /// @notice Test helper: set whether `user` is verified.
    function setVerified(address user, bool ok) external {
        _verified[user] = ok;
    }

    /// @notice Minimal Dojang isVerified interface — returns our stub state.
    function isVerified(address user, bytes32) external view returns (bool) {
        return _verified[user];
    }
}
