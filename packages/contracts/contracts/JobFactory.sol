// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./EscrowJob.sol";
import "./ReputationRegistry.sol";

contract JobFactory {
    address public immutable token;
    address public immutable reputationRegistry;
    address public immutable arbiter;

    address[] public allJobs;
    mapping(address => address[]) public jobsByClient;

    event JobCreated(address indexed jobContract, address indexed client, uint256 totalAmount, string metadataCid);

    constructor(address _token, address _registry, address _arbiter) {
        token = _token;
        reputationRegistry = _registry;
        arbiter = _arbiter;
    }

    function createJob(uint256[] calldata milestoneAmounts, string calldata metadataCid) external returns (address) {
        EscrowJob job = new EscrowJob(
            msg.sender,
            token,
            reputationRegistry,
            arbiter,
            milestoneAmounts,
            metadataCid
        );
        ReputationRegistry(reputationRegistry).authorizeCaller(address(job));

        allJobs.push(address(job));
        jobsByClient[msg.sender].push(address(job));

        uint256 total;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) total += milestoneAmounts[i];
        emit JobCreated(address(job), msg.sender, total, metadataCid);
        return address(job);
    }

    function getJobsByClient(address clientAddr) external view returns (address[] memory) {
        return jobsByClient[clientAddr];
    }

    function totalJobs() external view returns (uint256) {
        return allJobs.length;
    }
}
