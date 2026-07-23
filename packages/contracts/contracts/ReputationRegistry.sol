// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDojang
/// @notice Minimal Dojang interface for the GIWA-verified check.
interface IDojang {
    function isVerified(address user, bytes32 attesterId) external view returns (bool);
}

/// @title ReputationRegistry
/// @notice Portable, per-wallet reputation. Only authorized callers
///         (EscrowJob instances + Arbiter) may write. Every write
///         enforces the GIWA Dojang identity gate — a wallet without
///         a Verified Address cannot accrue reputation, defeating
///         Sybil / reputation-laundering attacks via fresh wallets.
contract ReputationRegistry {
    struct Reputation {
        uint32 completedJobs;
        uint32 onTimeCount;
        uint32 ratingSum;
        uint32 ratingCount;
        uint32 disputesReceived;
        uint32 disputesRaised;
        uint32 disputesLost;
    }

    mapping(address => Reputation) public records;
    mapping(address => bool) public authorizedCallers;

    address public immutable dojangScroll;
    bytes32 public immutable upbitAttesterId;
    address public factory;
    address public arbiter;

    event CallerAuthorized(address indexed caller);
    event ReputationUpdated(address indexed user);

    error NotAuthorized();
    error NotDojangVerified(address user);

    modifier onlyAuthorized() {
        if (!(authorizedCallers[msg.sender] || msg.sender == arbiter)) revert NotAuthorized();
        _;
    }

    modifier onlyFactoryOrArbiter() {
        require(msg.sender == factory || msg.sender == arbiter, "only factory or arbiter");
        _;
    }

    modifier dojangVerified(address user) {
        if (!IDojang(dojangScroll).isVerified(user, upbitAttesterId)) {
            revert NotDojangVerified(user);
        }
        _;
    }

    constructor(address _dojangScroll, address _factory, bytes32 _upbitAttesterId) {
        dojangScroll = _dojangScroll;
        factory = _factory;
        upbitAttesterId = _upbitAttesterId;
    }

    /// @notice Two-phase init: factory may not exist when this is constructed.
    function setFactory(address _factory) external {
        require(msg.sender == factory || msg.sender == tx.origin, "init once");
        factory = _factory;
    }

    function authorizeCaller(address jobContract) external onlyFactoryOrArbiter {
        authorizedCallers[jobContract] = true;
        emit CallerAuthorized(jobContract);
    }

    function recordCompletion(address user, bool onTime)
        external
        onlyAuthorized
        dojangVerified(user)
    {
        Reputation storage r = records[user];
        unchecked {
            r.completedJobs += 1;
            if (onTime) r.onTimeCount += 1;
        }
        emit ReputationUpdated(user);
    }

    function recordRating(address user, uint8 score)
        external
        onlyAuthorized
        dojangVerified(user)
    {
        require(score >= 1 && score <= 5, "score 1-5");
        Reputation storage r = records[user];
        unchecked {
            r.ratingSum += score;
            r.ratingCount += 1;
        }
        emit ReputationUpdated(user);
    }

    function recordDisputeRaised(address raiser)
        external
        onlyAuthorized
        dojangVerified(raiser)
    {
        unchecked { records[raiser].disputesRaised += 1; }
        emit ReputationUpdated(raiser);
    }

    function recordDisputeOutcome(address loser, address winner)
        external
        onlyAuthorized
        dojangVerified(loser)
    {
        unchecked {
            records[loser].disputesLost += 1;
            records[loser].disputesReceived += 1;
        }
        emit ReputationUpdated(loser);
        emit ReputationUpdated(winner);
    }

    /// @notice Reliability score 0-100, computed on read.
    function reliabilityScore(address user) external view returns (uint256) {
        Reputation memory r = records[user];
        if (r.completedJobs == 0) return 0;

        uint256 onTimeScore = (uint256(r.onTimeCount) * 40) / r.completedJobs;
        uint256 ratingScore = r.ratingCount == 0
            ? 0
            : (uint256(r.ratingSum) * 40) / (r.ratingCount * 5);
        uint256 disputePenalty = uint256(r.disputesReceived) * 5;
        uint256 disputeScore = disputePenalty >= 20 ? 0 : 20 - disputePenalty;

        return onTimeScore + ratingScore + disputeScore;
    }
}
