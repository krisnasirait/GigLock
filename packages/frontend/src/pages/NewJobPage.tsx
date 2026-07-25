import { addressesByChain, EscrowJobAbi, JOB_STATUS, JobFactoryAbi, MockUSDCAbi } from "@giglock/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatUnits, isAddress, isAddressEqual, type Address, type Hash } from "viem";
import { useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { fetchJobMetadata, uploadJobMetadata } from "../features/jobs/ipfs.js";
import { parseJobMetadata, parseUsdcAmount, type JobMetadataV1 } from "../features/jobs/model.js";
import { decodeCreatedJobAddress, invalidateJobQueries, runApprove, runCreate, runFund } from "../features/jobs/transactions.js";
import { CreateJobProgress, type CreateStage } from "../features/jobs/components/CreateJobProgress.js";
import { MilestoneEditor, type MilestoneDraft } from "../features/jobs/components/MilestoneEditor.js";
import { WalletGate, useWalletWriteAccess } from "../features/jobs/components/WalletGate.js";
import { publicClient } from "../lib/wagmi.js";

const giwaAddresses = addressesByChain[91342]!;
const MAX_UINT256 = (1n << 256n) - 1n;

type NewJobLocationState = {
  metadataCid?: string;
  jobAddress?: Address;
};

type FormDraft = {
  title: string;
  description: string;
  skills: string;
  milestones: MilestoneDraft[];
};

type ConfirmedJob = {
  address: Address;
  client: Address;
  metadataCid: string;
  totalAmount: bigint;
  status: number;
};

type PendingCreation = {
  hash: Hash;
  cid?: string;
};

type PendingFunding = {
  hash: Hash;
  jobAddress?: Address;
  cid?: string;
};

const initialMilestone = (): MilestoneDraft => ({
  id: crypto.randomUUID(),
  title: "",
  description: "",
  amountUsdc: "",
});

function firstMilestone(): MilestoneDraft {
  return { id: "first", title: "", description: "", amountUsdc: "" };
}

function emptyDraft(): FormDraft {
  return { title: "", description: "", skills: "", milestones: [firstMilestone()] };
}

function characterCount(value: string): number {
  return Array.from(value).length;
}

function errorMessage(error: unknown, action: "metadata" | "create" | "approve" | "fund"): string {
  if (
    typeof error === "object" && error !== null &&
    (("name" in error && (error as { name?: unknown }).name === "UserRejectedRequestError") ||
      ("code" in error && (error as { code?: unknown }).code === 4001))
  ) {
    return action === "fund"
      ? "You cancelled funding in your wallet. Your created job is ready to finish funding."
      : `You cancelled ${action === "approve" ? "approval" : action} in your wallet.`;
  }
  if (action === "metadata") return "Metadata upload failed. Your form is still here; retry when ready.";
  const message = error instanceof Error ? error.message : "";
  if (/revert|execution reverted|insufficient/i.test(message)) {
    return action === "create"
      ? "Escrow creation was reverted by the contract. Check the milestone amounts and try again."
      : action === "approve"
        ? "MockUSDC approval was reverted. Confirm your test balance and try again."
        : "Funding was reverted by the escrow contract. The job remains ready to finish funding.";
  }
  return action === "create"
    ? "Could not create the escrow on GIWA Sepolia. Try again."
    : action === "approve"
      ? "Could not approve MockUSDC. Try again."
      : "Could not fund the escrow. The job remains ready to finish funding.";
}

function validateDraft(draft: FormDraft, createdAt: string): { errors: Record<string, string>; metadata?: JobMetadataV1; amounts?: bigint[]; total?: bigint } {
  const errors: Record<string, string> = {};
  if (characterCount(draft.title) < 3 || characterCount(draft.title) > 100) errors.title = "Title must be 3–100 characters.";
  if (characterCount(draft.description) < 10 || characterCount(draft.description) > 4_000) errors.description = "Description must be 10–4,000 characters.";
  const skills = draft.skills.split(",").map((value) => value.trim()).filter(Boolean);
  if (skills.length > 10 || skills.some((skill) => characterCount(skill) > 32)) errors.skills = "Use at most 10 skills, each 1–32 characters.";

  const amounts: bigint[] = [];
  for (const milestone of draft.milestones) {
    const prefix = milestone.id;
    if (characterCount(milestone.title) < 3 || characterCount(milestone.title) > 100) errors[`${prefix}.title`] = "Milestone title must be 3–100 characters.";
    if (characterCount(milestone.description) > 1_000) errors[`${prefix}.description`] = "Milestone description must be at most 1,000 characters.";
    try {
      amounts.push(parseUsdcAmount(milestone.amountUsdc));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid amount";
      errors[`${prefix}.amountUsdc`] = `Milestone ${draft.milestones.indexOf(milestone) + 1} ${message.replace(/^USDC amount /, "amount ")}.`;
    }
  }
  const total = amounts.reduce((sum, amount) => sum + amount, 0n);
  if (total > MAX_UINT256) errors.total = "Total escrow must fit uint256.";
  if (Object.keys(errors).length > 0 || amounts.length !== draft.milestones.length) return { errors };

  try {
    const metadata = parseJobMetadata({
      schema: "giglock/job@1",
      title: draft.title,
      description: draft.description,
      skills,
      createdAt,
      milestones: draft.milestones.map(({ title, description, amountUsdc }) => ({ title, description, amountUsdc })),
    });
    return { errors, metadata, amounts, total };
  } catch (error) {
    return { errors: { form: error instanceof Error ? error.message : "Check the job details and try again." } };
  }
}

function draftFingerprint(metadata: JobMetadataV1): string {
  return JSON.stringify(metadata);
}

function draftFromMetadata(metadata: JobMetadataV1): FormDraft {
  return {
    title: metadata.title,
    description: metadata.description,
    skills: metadata.skills.join(", "),
    milestones: metadata.milestones.map((milestone) => ({ id: crypto.randomUUID(), ...milestone })),
  };
}

function locationHints(search: string): { jobAddress?: Address; metadataCid?: string; createHash?: Hash; fundHash?: Hash } {
  const params = new URLSearchParams(search);
  const candidate = params.get("job");
  return {
    jobAddress: candidate !== null && isAddress(candidate) ? candidate : undefined,
    metadataCid: params.get("cid") ?? undefined,
    createHash: params.get("createTx")?.startsWith("0x") ? params.get("createTx") as Hash : undefined,
    fundHash: params.get("fundTx")?.startsWith("0x") ? params.get("fundTx") as Hash : undefined,
  };
}

export function NewJobPage() {
  const { address, canWrite } = useWalletWriteAccess();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const initialState = location.state as NewJobLocationState | null;
  const hints = locationHints(location.search);
  const createdAtRef = useRef(new Date().toISOString());
  const pinnedMetadata = useRef(new Map<string, string>());
  const accountRef = useRef(address);
  const workflowGeneration = useRef(0);
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [metadataCid, setMetadataCid] = useState<string | undefined>(hints.metadataCid ?? initialState?.metadataCid);
  const [confirmedJob, setConfirmedJob] = useState<ConfirmedJob | undefined>();
  const [pendingCreation, setPendingCreation] = useState<PendingCreation | undefined>(() => hints.createHash ? {
    hash: hints.createHash,
    cid: hints.metadataCid ?? initialState?.metadataCid,
  } : undefined);
  const [pendingFunding, setPendingFunding] = useState<PendingFunding | undefined>(() => hints.fundHash ? {
    hash: hints.fundHash,
    jobAddress: hints.jobAddress ?? initialState?.jobAddress,
    cid: hints.metadataCid ?? initialState?.metadataCid,
  } : undefined);
  const [metadataUnavailable, setMetadataUnavailable] = useState(false);
  const [stage, setStage] = useState<CreateStage>("idle");
  const [workflowError, setWorkflowError] = useState<string | undefined>();
  const [hashes, setHashes] = useState<Partial<Record<"create" | "approve" | "fund", Hash>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressDetail, setProgressDetail] = useState<string | undefined>();
  const formRef = useRef<HTMLFormElement>(null);

  const liveTotal = useMemo(() => draft.milestones.reduce((sum, milestone) => {
    try { return sum + parseUsdcAmount(milestone.amountUsdc); } catch { return sum; }
  }, 0n), [draft.milestones]);

  async function findVerifiedJob(account: Address, input: { address?: Address; cid?: string; statuses?: readonly number[] }): Promise<ConfirmedJob | undefined> {
    const jobs = await publicClient.readContract({
      address: giwaAddresses.jobFactory,
      abi: JobFactoryAbi,
      functionName: "getJobsByClient",
      args: [account],
    });
    const candidates = input.address === undefined ? jobs : jobs.filter((job) => isAddressEqual(job, input.address!));
    for (const candidate of candidates) {
      const [client, candidateCid, totalAmount, status] = await Promise.all([
        publicClient.readContract({ address: candidate, abi: EscrowJobAbi, functionName: "client" }),
        publicClient.readContract({ address: candidate, abi: EscrowJobAbi, functionName: "metadataCid" }),
        publicClient.readContract({ address: candidate, abi: EscrowJobAbi, functionName: "totalAmount" }),
        publicClient.readContract({ address: candidate, abi: EscrowJobAbi, functionName: "status" }),
      ]);
      const allowedStatuses = input.statuses ?? [JOB_STATUS.Created];
      if (!isAddressEqual(client, account) || !allowedStatuses.includes(status) || (input.cid !== undefined && candidateCid !== input.cid)) continue;
      return { address: candidate, client, metadataCid: candidateCid, totalAmount, status };
    }
    return undefined;
  }

  function persistRecovery(next: { cid?: string; job?: Address; createTx?: Hash; fundTx?: Hash }) {
    const params = new URLSearchParams();
    if (next.cid) params.set("cid", next.cid);
    if (next.job) params.set("job", next.job);
    if (next.createTx) params.set("createTx", next.createTx);
    if (next.fundTx) params.set("fundTx", next.fundTx);
    navigate({ pathname: location.pathname, search: params.size === 0 ? "" : `?${params.toString()}` }, {
      replace: true,
      state: { metadataCid: next.cid, jobAddress: next.job } satisfies NewJobLocationState,
    });
  }

  async function adoptConfirmedJob(job: ConfirmedJob, account: Address, generation: number): Promise<boolean> {
    if (workflowGeneration.current !== generation || accountRef.current !== account) return false;
    setConfirmedJob(job);
    setMetadataCid(job.metadataCid);
    setPendingCreation(undefined);
    if (job.status === JOB_STATUS.Funded) setPendingFunding(undefined);
    setMetadataUnavailable(false);
    persistRecovery({ cid: job.metadataCid, job: job.address, fundTx: job.status === JOB_STATUS.Funded ? undefined : pendingFunding?.hash });
    try {
      const metadata = await fetchJobMetadata(job.metadataCid);
      if (workflowGeneration.current === generation && accountRef.current === account) setDraft(draftFromMetadata(metadata));
    } catch {
      if (workflowGeneration.current === generation && accountRef.current === account) setMetadataUnavailable(true);
    }
    return workflowGeneration.current === generation && accountRef.current === account;
  }

  async function completeFundedJob(job: ConfirmedJob, account: Address, generation: number): Promise<boolean> {
    if (job.status !== JOB_STATUS.Funded || !await adoptConfirmedJob(job, account, generation)) return false;
    if (workflowGeneration.current !== generation || accountRef.current !== account) return false;
    setStage("complete");
    setWorkflowError(undefined);
    setProgressDetail("Funding receipt confirmed. The escrow is available on-chain.");
    await invalidateJobQueries(queryClient, { jobAddress: job.address, accounts: [account] });
    return workflowGeneration.current === generation && accountRef.current === account;
  }

  useEffect(() => {
    if (accountRef.current === address) return;
    accountRef.current = address;
    workflowGeneration.current += 1;
    setConfirmedJob(undefined);
    setMetadataCid(undefined);
    setPendingCreation(undefined);
    setPendingFunding(undefined);
    setMetadataUnavailable(false);
    setHashes({});
    setErrors({});
    setWorkflowError(undefined);
    setProgressDetail(undefined);
    setStage("idle");
    setIsSubmitting(false);
    persistRecovery({});
  }, [address]);

  useEffect(() => {
    if (!address || confirmedJob) return;
    const account = address;
    const generation = workflowGeneration.current;
    let cancelled = false;
    async function recoverFromChain() {
      try {
        const hintedJob = hints.jobAddress ?? initialState?.jobAddress;
        const hintedCid = pendingCreation?.cid ?? hints.metadataCid ?? initialState?.metadataCid;
        if (!hintedJob && !hintedCid) return;
        const recovered = hintedJob
          ? await findVerifiedJob(account, { address: hintedJob, cid: hintedCid, statuses: [JOB_STATUS.Created, JOB_STATUS.Funded] })
          : hintedCid
            ? await findVerifiedJob(account, { cid: hintedCid, statuses: [JOB_STATUS.Created, JOB_STATUS.Funded] })
            : undefined;
        if (!cancelled && recovered) {
          if (recovered.status === JOB_STATUS.Funded) await completeFundedJob(recovered, account, generation);
          else await adoptConfirmedJob(recovered, account, generation);
        }
      } catch {
        // The route remains usable for a new job while the RPC is unavailable.
      }
    }
    void recoverFromChain();
    return () => { cancelled = true; };
  }, [address, confirmedJob, hints.jobAddress, hints.metadataCid, initialState?.jobAddress, initialState?.metadataCid, pendingCreation?.cid]);

  function updateDraft(field: Exclude<keyof FormDraft, "milestones">, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateMilestone(id: string, field: keyof Omit<MilestoneDraft, "id">, value: string) {
    setDraft((current) => ({ ...current, milestones: current.milestones.map((milestone) => milestone.id === id ? { ...milestone, [field]: value } : milestone) }));
  }

  async function runWorkflow() {
    if (!canWrite || !address || isSubmitting || stage === "complete") return;
    const account = address;
    const generation = ++workflowGeneration.current;
    const stillCurrent = () => workflowGeneration.current === generation && accountRef.current === account;
    setWorkflowError(undefined);
    let fundingJob = confirmedJob;
    if (pendingFunding) {
      const pending = pendingFunding;
      if (!pending.jobAddress) {
        setStage("error");
        setWorkflowError("The submitted funding transaction is missing its escrow identity. Keep this route open and check the transaction before posting another job.");
        return;
      }
      setIsSubmitting(true);
      const verifyFundingStatus = () => findVerifiedJob(account, {
        address: pending.jobAddress,
        cid: pending.cid,
        statuses: [JOB_STATUS.Created, JOB_STATUS.Funded],
      });
      try {
        const beforeReceipt = await verifyFundingStatus();
        if (!stillCurrent()) return;
        if (beforeReceipt?.status === JOB_STATUS.Funded) {
          await completeFundedJob(beforeReceipt, account, generation);
          return;
        }
        if (!beforeReceipt) throw new Error("Funding escrow could not be verified.");
        fundingJob = beforeReceipt;
        await adoptConfirmedJob(beforeReceipt, account, generation);
        setStage("fund");
        setProgressDetail("Checking the submitted funding transaction on GIWA Sepolia…");
        const receipt = await publicClient.waitForTransactionReceipt({ hash: pending.hash });
        if (!stillCurrent()) return;
        const afterReceipt = await verifyFundingStatus();
        if (afterReceipt?.status === JOB_STATUS.Funded) {
          await completeFundedJob(afterReceipt, account, generation);
          return;
        }
        if (receipt.status !== "success") {
          setPendingFunding(undefined);
          persistRecovery({ cid: beforeReceipt.metadataCid, job: beforeReceipt.address });
          setStage("error");
          setWorkflowError("Funding transaction was reverted on GIWA Sepolia. You can try funding again.");
          setIsSubmitting(false);
          return;
        }
        setStage("error");
        setWorkflowError("The submitted funding receipt has not produced a funded escrow yet. Keep checking this transaction before trying again.");
        setIsSubmitting(false);
        return;
      } catch {
        if (!stillCurrent()) return;
        const afterFailure = await verifyFundingStatus().catch(() => undefined);
        if (afterFailure?.status === JOB_STATUS.Funded) {
          await completeFundedJob(afterFailure, account, generation);
          return;
        }
        setStage("error");
        setWorkflowError("Funding is still pending or its receipt is unavailable. Check the submitted transaction before trying again.");
        setIsSubmitting(false);
        return;
      }
    }
    if (!fundingJob && pendingCreation) {
      const pending = pendingCreation;
      if (!pending.cid) {
        setStage("error");
        setWorkflowError("The submitted creation transaction is missing its metadata identity. Keep this route open and check the transaction before posting another job.");
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(true);
      try {
        setStage("create");
        setProgressDetail("Checking the submitted creation transaction on GIWA Sepolia…");
        const receipt = await publicClient.waitForTransactionReceipt({ hash: pending.hash });
        if (!stillCurrent()) return;
        if (receipt.status === "success") {
          const createdAddress = decodeCreatedJobAddress(receipt, giwaAddresses.jobFactory);
          const found = await findVerifiedJob(account, { address: createdAddress, cid: pending.cid });
          if (!found) {
            setStage("error");
            setWorkflowError("The submitted creation receipt has not produced a verified escrow yet. Keep checking this transaction before posting another job.");
            setIsSubmitting(false);
            return;
          }
          fundingJob = found;
          await adoptConfirmedJob(found, account, generation);
        } else {
          const found = await findVerifiedJob(account, { cid: pending.cid });
          if (found) {
            fundingJob = found;
            await adoptConfirmedJob(found, account, generation);
          } else {
            setPendingCreation(undefined);
            setMetadataCid(pending.cid);
            persistRecovery({ cid: pending.cid });
          }
        }
      } catch {
        if (!stillCurrent()) return;
        const found = await findVerifiedJob(account, { cid: pending.cid }).catch(() => undefined);
        if (found) {
          fundingJob = found;
          await adoptConfirmedJob(found, account, generation);
        } else {
          setStage("error");
          setWorkflowError("Creation is still pending or its receipt is unavailable. Check the submitted transaction before trying again.");
          setIsSubmitting(false);
          return;
        }
      }
    }
    let validation: ReturnType<typeof validateDraft> | undefined;
    if (!fundingJob) {
      validation = validateDraft(draft, createdAtRef.current);
      setErrors(validation.errors);
      if (!validation.metadata || !validation.amounts || validation.total === undefined) {
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
        return;
      }
    }
    setIsSubmitting(true);
    let cid = fundingJob?.metadataCid ?? metadataCid;
    if (!fundingJob) {
      try {
        const fingerprint = draftFingerprint(validation!.metadata!);
        if (!cid || pinnedMetadata.current.get(fingerprint) !== cid) {
          const previousCid = pinnedMetadata.current.get(fingerprint);
          if (previousCid) cid = previousCid;
          else {
            setStage("metadata");
            setProgressDetail("Pinning the canonical job metadata to IPFS…");
            const pinned = await uploadJobMetadata(validation!.metadata!);
            cid = pinned.cid;
            pinnedMetadata.current.set(fingerprint, cid);
          }
          if (!stillCurrent()) return;
          setMetadataCid(cid);
          persistRecovery({ cid });
        }
      } catch (error) {
        if (!stillCurrent()) return;
        setStage("error");
        setWorkflowError(errorMessage(error, "metadata"));
        setIsSubmitting(false);
        return;
      }
      try {
        fundingJob = await findVerifiedJob(account, { cid });
        if (!stillCurrent()) return;
        if (fundingJob) await adoptConfirmedJob(fundingJob, account, generation);
      } catch {
        // A failed preflight is not evidence that a job exists; do not create until the RPC succeeds.
        if (!stillCurrent()) return;
        setStage("error");
        setWorkflowError("Could not verify existing escrows on GIWA Sepolia. Try again before creating a new one.");
        setIsSubmitting(false);
        return;
      }
    }

    if (!fundingJob) {
      try {
        setStage("create");
        setProgressDetail("Confirm escrow creation in your wallet.");
        const created = await runCreate({
          writeContract: async (request) => {
            const hash = await writeContractAsync(request as never);
            if (!stillCurrent()) throw new Error("Wallet account changed before creation was submitted.");
            setHashes((current) => ({ ...current, create: hash }));
            setPendingCreation({ hash, cid });
            persistRecovery({ cid, createTx: hash });
            setProgressDetail("Escrow creation submitted. Waiting for the GIWA receipt…");
            return hash;
          },
          waitForReceipt: publicClient.waitForTransactionReceipt,
          factory: giwaAddresses.jobFactory,
          request: { address: giwaAddresses.jobFactory, abi: JobFactoryAbi, functionName: "createJob", args: [validation!.amounts!, cid], chainId: 91342 },
        });
        if (!stillCurrent()) return;
        const verified = await findVerifiedJob(account, { address: created.jobAddress, cid });
        if (!verified) throw new Error("Confirmed create receipt could not be verified against the factory client job list.");
        fundingJob = verified;
        setHashes((current) => ({ ...current, create: created.hash }));
        await adoptConfirmedJob(verified, account, generation);
        await invalidateJobQueries(queryClient, { jobAddress: verified.address });
      } catch (error) {
        if (!stillCurrent()) return;
        const found = await findVerifiedJob(account, { cid }).catch(() => undefined);
        if (found) {
          fundingJob = found;
          await adoptConfirmedJob(found, account, generation);
          await invalidateJobQueries(queryClient, { jobAddress: found.address });
        } else {
          setStage("error");
          setWorkflowError(errorMessage(error, "create"));
          setIsSubmitting(false);
          return;
        }
      }
    }

    if (!fundingJob || !stillCurrent()) {
      setIsSubmitting(false);
      return;
    }
    const confirmedAddress = fundingJob.address;
    const total = fundingJob.totalAmount;

    let allowance = 0n;
    try {
      allowance = await publicClient.readContract({
        address: giwaAddresses.mockUsdc,
        abi: MockUSDCAbi,
        functionName: "allowance",
        args: [account, confirmedAddress],
      });
    } catch {
      // Approval is safe to request again; the receipt remains the source of truth for funding.
    }
    if (!stillCurrent()) return;
    if (allowance < total) {
      try {
        setStage("approve");
        setProgressDetail("Confirm the exact MockUSDC approval in your wallet.");
        const approved = await runApprove({
          writeContract: async (request) => {
            const hash = await writeContractAsync(request as never);
            if (!stillCurrent()) throw new Error("Wallet account changed before approval was submitted.");
            setHashes((current) => ({ ...current, approve: hash }));
            setProgressDetail("Approval submitted. Waiting for the GIWA receipt…");
            return hash;
          },
          waitForReceipt: publicClient.waitForTransactionReceipt,
          request: {
            address: giwaAddresses.mockUsdc,
            abi: MockUSDCAbi,
            functionName: "approve",
            args: [confirmedAddress, total],
            chainId: 91342,
          },
        });
        if (!stillCurrent()) return;
        setHashes((current) => ({ ...current, approve: approved.hash }));
      } catch (error) {
        if (!stillCurrent()) return;
        setStage("error");
        setWorkflowError(errorMessage(error, "approve"));
        setIsSubmitting(false);
        return;
      }
    }

    let submittedFunding: PendingFunding | undefined;
    try {
      setStage("fund");
      setProgressDetail("Confirm funding in your wallet.");
      const funded = await runFund({
        writeContract: async (request) => {
          const hash = await writeContractAsync(request as never);
          if (!stillCurrent()) throw new Error("Wallet account changed before funding was submitted.");
          setHashes((current) => ({ ...current, fund: hash }));
          submittedFunding = { hash, jobAddress: confirmedAddress, cid: fundingJob.metadataCid };
          setPendingFunding(submittedFunding);
          persistRecovery({ cid: fundingJob.metadataCid, job: confirmedAddress, fundTx: hash });
          setProgressDetail("Funding submitted. Waiting for the GIWA receipt…");
          return hash;
        },
        waitForReceipt: publicClient.waitForTransactionReceipt,
        request: {
          address: confirmedAddress,
          abi: EscrowJobAbi,
          functionName: "fundJob",
          chainId: 91342,
        },
      });
      if (!stillCurrent()) return;
      setHashes((current) => ({ ...current, fund: funded.hash }));
      setPendingFunding(undefined);
      persistRecovery({ cid: fundingJob.metadataCid, job: confirmedAddress });
      setStage("complete");
      setProgressDetail("Funding receipt confirmed. The escrow is available on-chain.");
      await invalidateJobQueries(queryClient, { jobAddress: confirmedAddress, accounts: [account] });
    } catch (error) {
      if (!stillCurrent()) return;
      if (!submittedFunding) {
        setStage("error");
        setWorkflowError(errorMessage(error, "fund"));
      } else {
        const recovered = await findVerifiedJob(account, {
          address: submittedFunding.jobAddress,
          cid: submittedFunding.cid,
          statuses: [JOB_STATUS.Created, JOB_STATUS.Funded],
        }).catch(() => undefined);
        if (recovered?.status === JOB_STATUS.Funded) {
          await completeFundedJob(recovered, account, generation);
        } else if (/did not receive a successful receipt/i.test(error instanceof Error ? error.message : "")) {
          setPendingFunding(undefined);
          persistRecovery({ cid: fundingJob.metadataCid, job: confirmedAddress });
          setStage("error");
          setWorkflowError("Funding transaction was reverted on GIWA Sepolia. You can try funding again.");
        } else {
          setStage("error");
          setWorkflowError("Funding is still pending or its receipt is unavailable. Check the submitted transaction before trying again.");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const draftLocked = Boolean(confirmedJob || pendingCreation || pendingFunding);
  const displayedTotal = confirmedJob?.totalAmount ?? liveTotal;
  const retryingMetadata = stage === "error" && !confirmedJob && !pendingCreation && !pendingFunding && workflowError?.startsWith("Metadata upload failed") === true;
  const actionLabel = stage === "complete" ? "Escrow funded" : pendingCreation ? "Check submitted creation" : pendingFunding ? "Check submitted funding" : retryingMetadata ? "Retry metadata upload" : confirmedJob ? "Finish funding" : "Create and fund escrow";

  return (
    <div className="dashboard-page new-job-page max-w-4xl mx-auto px-4 sm:px-6">
      <header className="dashboard-header mb-6">
        <div>
          <p className="dashboard-overline text-xs font-bold text-cyan-400 uppercase tracking-widest">Testnet escrow workspace</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1">Post a job</h1>
          <p className="text-sm sm:text-base text-white/60 mt-2 max-w-2xl">Describe the work, pin its brief to IPFS, then create and fund a GIWA Sepolia escrow.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-semibold shrink-0">
          <span className="size-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" aria-hidden="true" />
          GIWA Sepolia · Chain 91342
        </div>
      </header>

      <WalletGate />

      <form ref={formRef} className="new-job-form mt-6 space-y-6" onSubmit={(event) => { event.preventDefault(); void runWorkflow(); }} noValidate>
        {/* Job Brief Card */}
        <section className="card-glass border border-white/10 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/40 space-y-6" aria-labelledby="job-details-heading">
          <div className="border-b border-white/10 pb-5">
            <p className="dashboard-overline text-xs font-bold text-cyan-400 uppercase tracking-widest">Job brief</p>
            <h2 id="job-details-heading" className="text-xl font-extrabold text-white tracking-tight mt-1">Make the agreement clear</h2>
            <p className="text-xs text-white/50 mt-1">All fields are stored in IPFS metadata.</p>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="job-title" className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                Job title
              </label>
              <input
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                id="job-title"
                value={draft.title}
                maxLength={100}
                placeholder="e.g. ERC-721 Smart Contract and Minting DApp"
                disabled={draftLocked}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "job-title-error" : undefined}
                onChange={(event) => updateDraft("title", event.target.value)}
              />
              {errors.title && <p id="job-title-error" className="text-xs text-rose-400 mt-1.5 font-medium">{errors.title}</p>}
            </div>

            <div>
              <label htmlFor="job-description" className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                Job description
              </label>
              <textarea
                className="min-h-36 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all leading-relaxed"
                id="job-description"
                value={draft.description}
                maxLength={4000}
                placeholder="I need an experienced Web3 developer to write, test, and deploy an ERC-721A smart contract..."
                disabled={draftLocked}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={errors.description ? "job-description-error" : undefined}
                onChange={(event) => updateDraft("description", event.target.value)}
              />
              {errors.description && <p id="job-description-error" className="text-xs text-rose-400 mt-1.5 font-medium">{errors.description}</p>}
            </div>

            <div>
              <label htmlFor="job-skills" className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                Skills
              </label>
              <input
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                id="job-skills"
                value={draft.skills}
                placeholder="Solidity, React, Ethers.js, ERC-721, Hardhat"
                disabled={draftLocked}
                aria-invalid={errors.skills ? true : undefined}
                aria-describedby={errors.skills ? "job-skills-error job-skills-help" : "job-skills-help"}
                onChange={(event) => updateDraft("skills", event.target.value)}
              />
              <p id="job-skills-help" className="text-xs text-white/40 mt-1.5">Separate up to 10 skills with commas. Each skill can be 1–32 characters.</p>
              {errors.skills && <p id="job-skills-error" className="text-xs text-rose-400 mt-1.5 font-medium">{errors.skills}</p>}
            </div>
          </div>
        </section>

        {/* Milestone Editor */}
        <MilestoneEditor
          milestones={draft.milestones}
          errors={errors}
          onChange={updateMilestone}
          onAdd={() => setDraft((current) => current.milestones.length >= 10 ? current : { ...current, milestones: [...current.milestones, initialMilestone()] })}
          onRemove={(id) => setDraft((current) => current.milestones.length <= 1 ? current : { ...current, milestones: current.milestones.filter((milestone) => milestone.id !== id) })}
          disabled={draftLocked}
        />

        {/* Submit & Escrow Summary Card */}
        <section className="card-glass border border-white/10 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/40 space-y-5" aria-label="Escrow funding">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="dashboard-overline text-xs font-bold text-emerald-400 uppercase tracking-widest">Escrow amount</p>
              <p className="text-2xl font-black text-white tracking-tight mt-1">
                Total escrow: {formatUnits(displayedTotal, 6)} USDC
              </p>
            </div>
            {confirmedJob && (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                Escrow funded
              </div>
            )}
          </div>

          {metadataUnavailable && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl" role="status">
              Metadata is unavailable from IPFS. The verified on-chain escrow amount is shown below; this job is read-only.
            </p>
          )}

          {(errors.total || errors.form) && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl font-medium" role="alert">
              {errors.total ?? errors.form}
            </p>
          )}

          <p className="text-xs text-white/50 leading-relaxed">
            MockUSDC is approved for this exact total, then transferred only after the approval receipt confirms.
          </p>

          {confirmedJob && (
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-white/50 font-medium">Escrow address:</span>
              <code className="text-cyan-300 font-mono select-all">{confirmedJob.address}</code>
            </div>
          )}

          <button
            className="btn-primary w-full py-3.5 text-sm font-bold rounded-xl shadow-lg shadow-[#3b82f6]/25 transition-all flex items-center justify-center gap-2"
            type="submit"
            disabled={!canWrite || isSubmitting || stage === "complete"}
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Confirm in wallet…
              </>
            ) : (
              actionLabel
            )}
          </button>

          {!canWrite && (
            <p className="text-xs text-center text-amber-300/80">Connect a wallet on GIWA Sepolia to create an escrow.</p>
          )}
        </section>
      </form>

      <CreateJobProgress stage={stage} hashes={hashes} error={workflowError} detail={progressDetail} />

      {stage === "complete" && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center font-bold text-sm shadow-lg shadow-emerald-500/5 flex items-center justify-center gap-2" role="status">
          <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Escrow funded on GIWA Sepolia.
        </div>
      )}
    </div>
  );
}
