// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IReputationRegistryEscrow {
    function recordCompletion(address user, bool onTime) external;
    function recordRating(address user, uint8 score) external;
    function recordDisputeRaised(address raiser) external;
    function recordDisputeOutcome(address loser, address winner) external;
}

interface IArbiterEscrow {
    function fileDispute(uint256 milestoneId) external;
}

contract EscrowJob is ReentrancyGuard {
    enum JobStatus { Created, Funded, InProgress, Completed, Cancelled }
    enum MilestoneStatus { Pending, Submitted, Confirmed, Disputed, Released, Refunded }

    struct Milestone {
        uint256 amount;
        MilestoneStatus status;
        bytes32 proofHash;
        uint256 submittedAt;
        uint256 confirmDeadline;
    }

    address public immutable client;
    address public worker;
    IERC20 public immutable token;
    IReputationRegistryEscrow public immutable reputationRegistry;
    address public immutable arbiter;

    uint256 public constant CONFIRM_WINDOW = 48 hours;

    Milestone[] public milestones;
    JobStatus public status;
    bool public workerAccepted;

    event JobFunded(uint256 totalAmount);
    event JobAccepted(address indexed worker);
    event MilestoneSubmitted(uint256 indexed milestoneId, bytes32 proofHash, uint256 deadline);
    event MilestoneConfirmed(uint256 indexed milestoneId, address by);
    event MilestoneReleased(uint256 indexed milestoneId, uint256 amount, string releaseType);
    event DisputeRaised(uint256 indexed milestoneId);
    event DisputeResolved(uint256 indexed milestoneId, address winner);
    event RatingSubmitted(address indexed rater, address indexed ratee, uint8 score);
    event JobCancelled();

    modifier onlyClient() { require(msg.sender == client, "not client"); _; }
    modifier onlyWorker() { require(msg.sender == worker, "not worker"); _; }
    modifier onlyArbiter() { require(msg.sender == arbiter, "not arbiter"); _; }

    constructor(
        address _client,
        address _token,
        address _reputationRegistry,
        address _arbiter,
        uint256[] memory milestoneAmounts
    ) {
        require(milestoneAmounts.length > 0, "no milestones");
        client = _client;
        token = IERC20(_token);
        reputationRegistry = IReputationRegistryEscrow(_reputationRegistry);
        arbiter = _arbiter;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            milestones.push(Milestone({
                amount: milestoneAmounts[i],
                status: MilestoneStatus.Pending,
                proofHash: bytes32(0),
                submittedAt: 0,
                confirmDeadline: 0
            }));
        }
        status = JobStatus.Created;
    }

    function fundJob() external onlyClient nonReentrant {
        require(status == JobStatus.Created, "already funded");
        uint256 total = totalAmount();
        require(token.transferFrom(msg.sender, address(this), total), "transfer failed");
        status = JobStatus.Funded;
        emit JobFunded(total);
    }

    function acceptJob() external nonReentrant {
        require(status == JobStatus.Funded, "not fundable state");
        require(!workerAccepted, "already accepted");
        worker = msg.sender;
        workerAccepted = true;
        status = JobStatus.InProgress;
        emit JobAccepted(msg.sender);
    }

    function submitMilestone(uint256 milestoneId, bytes32 proofHash) external onlyWorker {
        Milestone storage m = milestones[milestoneId];
        require(m.status == MilestoneStatus.Pending, "invalid state");
        m.status = MilestoneStatus.Submitted;
        m.proofHash = proofHash;
        m.submittedAt = block.timestamp;
        m.confirmDeadline = block.timestamp + CONFIRM_WINDOW;
        emit MilestoneSubmitted(milestoneId, proofHash, m.confirmDeadline);
    }

    function confirmMilestone(uint256 milestoneId) external onlyClient nonReentrant {
        Milestone storage m = milestones[milestoneId];
        require(m.status == MilestoneStatus.Submitted, "not submitted");
        m.status = MilestoneStatus.Confirmed;
        _release(milestoneId, "manual_confirm");
        emit MilestoneConfirmed(milestoneId, msg.sender);
    }

    function claimTimeout(uint256 milestoneId) external onlyWorker nonReentrant {
        Milestone storage m = milestones[milestoneId];
        require(m.status == MilestoneStatus.Submitted, "not submitted");
        require(block.timestamp > m.confirmDeadline, "window not elapsed");
        m.status = MilestoneStatus.Confirmed;
        _release(milestoneId, "timeout_auto_release");
        reputationRegistry.recordCompletion(worker, true);
    }

    function raiseDispute(uint256 milestoneId) external onlyClient {
        Milestone storage m = milestones[milestoneId];
        require(m.status == MilestoneStatus.Submitted, "not submitted");
        require(block.timestamp <= m.confirmDeadline, "window elapsed, use claimTimeout");
        m.status = MilestoneStatus.Disputed;
        reputationRegistry.recordDisputeRaised(client);
        IArbiterEscrow(arbiter).fileDispute(milestoneId);
        emit DisputeRaised(milestoneId);
    }

    function resolveDispute(uint256 milestoneId, bool releaseToWorker) external onlyArbiter nonReentrant {
        Milestone storage m = milestones[milestoneId];
        require(m.status == MilestoneStatus.Disputed, "not disputed");

        if (releaseToWorker) {
            m.status = MilestoneStatus.Confirmed;
            _release(milestoneId, "dispute_resolved_worker");
            reputationRegistry.recordDisputeOutcome(client, worker);
        } else {
            m.status = MilestoneStatus.Refunded;
            require(token.transfer(client, m.amount), "refund failed");
            reputationRegistry.recordDisputeOutcome(worker, client);
        }
        emit DisputeResolved(milestoneId, releaseToWorker ? worker : client);
    }

    function rate(address ratee, uint8 score) external {
        require(msg.sender == client || msg.sender == worker, "not a party");
        require(ratee == client || ratee == worker, "invalid ratee");
        require(ratee != msg.sender, "cannot rate self");
        require(score >= 1 && score <= 5, "score 1-5");
        reputationRegistry.recordRating(ratee, score);
        emit RatingSubmitted(msg.sender, ratee, score);
    }

    function _release(uint256 milestoneId, string memory releaseType) internal {
        Milestone storage m = milestones[milestoneId];
        m.status = MilestoneStatus.Released;
        require(token.transfer(worker, m.amount), "release failed");
        emit MilestoneReleased(milestoneId, m.amount, releaseType);

        if (_allMilestonesReleased()) {
            status = JobStatus.Completed;
        }
    }

    function _allMilestonesReleased() internal view returns (bool) {
        for (uint256 i = 0; i < milestones.length; i++) {
            MilestoneStatus s = milestones[i].status;
            if (s != MilestoneStatus.Released && s != MilestoneStatus.Refunded) {
                return false;
            }
        }
        return true;
    }

    function totalAmount() public view returns (uint256 sum) {
        for (uint256 i = 0; i < milestones.length; i++) sum += milestones[i].amount;
    }

    function milestoneCount() external view returns (uint256) {
        return milestones.length;
    }
}
