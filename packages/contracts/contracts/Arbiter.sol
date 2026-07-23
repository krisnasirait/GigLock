// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Arbiter (stub — full state machine comes in Task 3)
/// @notice JobFactory needs an Arbiter address at construction time.
contract Arbiter {
    address public admin;

    constructor(address _admin) {
        admin = _admin;
    }
}
