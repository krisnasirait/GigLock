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
    setProgressDetail("Funding is confirmed on GIWA Sepolia.");
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
    <div className="dashboard-page new-job-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-overline">Testnet escrow workspace</p>
          <h1>Post a job</h1>
          <p>Describe the work, pin its brief to IPFS, then create and fund a GIWA Sepolia escrow.</p>
        </div>
        <p className="dashboard-network"><span aria-hidden="true" /> GIWA Sepolia · Chain 91342</p>
      </header>

      <WalletGate />

      <form ref={formRef} className="new-job-form mt-4 grid gap-4" onSubmit={(event) => { event.preventDefault(); void runWorkflow(); }} noValidate>
        <section className="new-job-card card-glass rounded-xl p-5 sm:p-6" aria-labelledby="job-details-heading">
          <div className="new-job-section-heading">
            <div><p className="dashboard-overline">Job brief</p><h2 id="job-details-heading">Make the agreement clear</h2></div>
            <p className="new-job-limit">All fields are stored in IPFS metadata.</p>
          </div>
          <label htmlFor="job-title">Job title</label>
          <input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-300" id="job-title" value={draft.title} maxLength={100} disabled={draftLocked} aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? "job-title-error" : undefined} onChange={(event) => updateDraft("title", event.target.value)} />
          {errors.title ? <p id="job-title-error" className="new-job-error">{errors.title}</p> : null}
          <label htmlFor="job-description">Job description</label>
          <textarea className="mt-1 min-h-32 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-300" id="job-description" value={draft.description} maxLength={4000} disabled={draftLocked} aria-invalid={errors.description ? true : undefined} aria-describedby={errors.description ? "job-description-error" : undefined} onChange={(event) => updateDraft("description", event.target.value)} />
          {errors.description ? <p id="job-description-error" className="new-job-error">{errors.description}</p> : null}
          <label htmlFor="job-skills">Skills</label>
          <input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-300" id="job-skills" value={draft.skills} disabled={draftLocked} aria-invalid={errors.skills ? true : undefined} aria-describedby={errors.skills ? "job-skills-error job-skills-help" : "job-skills-help"} onChange={(event) => updateDraft("skills", event.target.value)} />
          <p id="job-skills-help" className="new-job-helper">Separate up to 10 skills with commas. Each skill can be 1–32 characters.</p>
          {errors.skills ? <p id="job-skills-error" className="new-job-error">{errors.skills}</p> : null}
        </section>

        <MilestoneEditor
          milestones={draft.milestones}
          errors={errors}
          onChange={updateMilestone}
          onAdd={() => setDraft((current) => current.milestones.length >= 10 ? current : { ...current, milestones: [...current.milestones, initialMilestone()] })}
          onRemove={(id) => setDraft((current) => current.milestones.length <= 1 ? current : { ...current, milestones: current.milestones.filter((milestone) => milestone.id !== id) })}
          disabled={draftLocked}
        />

        <section className="new-job-submit card-glass rounded-xl p-5 sm:p-6" aria-label="Escrow funding">
          <p className="dashboard-overline">Escrow amount</p>
          <p className="new-job-total">Total escrow: {formatUnits(displayedTotal, 6)} USDC</p>
          {metadataUnavailable ? <p className="new-job-helper" role="status">Metadata is unavailable from IPFS. The verified on-chain escrow amount is shown below; this job is read-only.</p> : null}
          {errors.total || errors.form ? <p className="new-job-error" role="alert">{errors.total ?? errors.form}</p> : null}
          <p className="new-job-helper">MockUSDC is approved for this exact total, then transferred only after the approval receipt confirms.</p>
          {confirmedJob ? <p className="new-job-address">Escrow address: <code>{confirmedJob.address}</code></p> : null}
          <button className="btn-primary new-job-submit-button" type="submit" disabled={!canWrite || isSubmitting || stage === "complete"}>
            {isSubmitting ? "Confirm in wallet…" : actionLabel}
          </button>
          {!canWrite ? <p className="new-job-helper">Connect a wallet on GIWA Sepolia to create an escrow.</p> : null}
        </section>
      </form>

      <CreateJobProgress stage={stage} hashes={hashes} error={workflowError} detail={progressDetail} />
      {stage === "complete" ? <p className="new-job-success" role="status">Escrow funded on GIWA Sepolia.</p> : null}
    </div>
  );
}
