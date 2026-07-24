// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEscrowJobForArbiter {
    function resolveDispute(uint256 milestoneId, bool releaseToWorker) external;
}

contract Arbiter {
    address public admin;

    struct DisputeCase {
        address jobContract;
        uint256 milestoneId;
        bool resolved;
        bool releasedToWorker;
    }

    mapping(uint256 => DisputeCase) public cases;
    uint256 public caseCount;

    event DisputeFiled(uint256 indexed caseId, address indexed jobContract, uint256 milestoneId);
    event DisputeDecided(uint256 indexed caseId, bool releasedToWorker);

    error NotAdmin();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _admin) {
        admin = _admin;
    }

    function fileDispute(uint256 milestoneId) external {
        cases[caseCount] = DisputeCase({
            jobContract: msg.sender,
            milestoneId: milestoneId,
            resolved: false,
            releasedToWorker: false
        });
        emit DisputeFiled(caseCount, msg.sender, milestoneId);
        caseCount++;
    }

    function decide(uint256 caseId, bool releaseToWorker) external onlyAdmin {
        DisputeCase storage c = cases[caseId];
        require(!c.resolved, "already resolved");
        c.resolved = true;
        c.releasedToWorker = releaseToWorker;
        IEscrowJobForArbiter(c.jobContract).resolveDispute(c.milestoneId, releaseToWorker);
        emit DisputeDecided(caseId, releaseToWorker);
    }
}
