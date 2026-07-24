import { describe, expect, it } from "vitest";
import { EscrowJobAbi, JobFactoryAbi } from "@giglock/shared";

type AbiParameter = { readonly type: string };
type AbiItem = {
  readonly type: string;
  readonly name?: string;
  readonly inputs?: readonly AbiParameter[];
  readonly outputs?: readonly AbiParameter[];
};

function functionAbi(
  abi: readonly AbiItem[],
  name: string,
) {
  return abi.find((item) => item.type === "function" && item.name === name);
}

describe("CID-aware shared contract ABIs", () => {
  it("exports CID-aware job and milestone signatures", () => {
    const submitMilestone = functionAbi(EscrowJobAbi, "submitMilestone");
    const milestones = functionAbi(EscrowJobAbi, "milestones");
    const metadataCid = functionAbi(EscrowJobAbi, "metadataCid");
    const createJob = functionAbi(JobFactoryAbi, "createJob");

    expect(submitMilestone?.inputs).toHaveLength(3);
    expect(submitMilestone?.inputs?.[2]?.type).toBe("string");
    expect(metadataCid?.outputs?.[0]?.type).toBe("string");
    expect(milestones?.outputs?.[3]?.type).toBe("string");
    expect(createJob?.inputs).toHaveLength(2);
    expect(createJob?.inputs?.[1]?.type).toBe("string");
  });
});
