import { addressesByChain, EscrowJobAbi, JobFactoryAbi, MockUSDCAbi } from "@giglock/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatUnits, type Address, type Hash } from "viem";
import { useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { uploadJobMetadata } from "../features/jobs/ipfs.js";
import { parseJobMetadata, parseUsdcAmount, type JobMetadataV1 } from "../features/jobs/model.js";
import { invalidateJobQueries, runApprove, runCreate, runFund } from "../features/jobs/transactions.js";
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

export function NewJobPage() {
  const { address, canWrite } = useWalletWriteAccess();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const initialState = location.state as NewJobLocationState | null;
  const createdAtRef = useRef(new Date().toISOString());
  const pinnedMetadata = useRef(new Map<string, string>());
  const isRecoveringNavigationState = useRef(Boolean(initialState?.jobAddress));
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [metadataCid, setMetadataCid] = useState<string | undefined>(initialState?.metadataCid);
  const [jobAddress, setJobAddress] = useState<Address | undefined>(initialState?.jobAddress);
  const [stage, setStage] = useState<CreateStage>("idle");
  const [workflowError, setWorkflowError] = useState<string | undefined>();
  const [hashes, setHashes] = useState<Partial<Record<"create" | "approve" | "fund", Hash>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressDetail, setProgressDetail] = useState<string | undefined>();
  const formRef = useRef<HTMLFormElement>(null);

  const liveTotal = useMemo(() => draft.milestones.reduce((sum, milestone) => {
    try { return sum + parseUsdcAmount(milestone.amountUsdc); } catch { return sum; }
  }, 0n), [draft.milestones]);

  useEffect(() => {
    if (!address || !metadataCid || jobAddress) return;
    const account = address;
    let cancelled = false;
    async function recoverFromChain() {
      try {
        const jobs = await publicClient.readContract({
          address: giwaAddresses.jobFactory,
          abi: JobFactoryAbi,
          functionName: "getJobsByClient",
          args: [account],
        });
        for (const candidate of jobs) {
          const candidateCid = await publicClient.readContract({
            address: candidate,
            abi: EscrowJobAbi,
            functionName: "metadataCid",
          });
          if (!cancelled && candidateCid === metadataCid) {
            setJobAddress(candidate);
            navigate(".", { replace: true, state: { metadataCid, jobAddress: candidate } satisfies NewJobLocationState });
            return;
          }
        }
      } catch {
        // The user can still continue with the confirmed navigation state once their RPC reconnects.
      }
    }
    void recoverFromChain();
    return () => { cancelled = true; };
  }, [address, jobAddress, metadataCid, navigate]);

  useEffect(() => {
    if (!isRecoveringNavigationState.current || !jobAddress || !metadataCid) return;
    let cancelled = false;
    void publicClient.readContract({ address: jobAddress, abi: EscrowJobAbi, functionName: "metadataCid" })
      .then((onChainCid) => {
        if (!cancelled && onChainCid !== metadataCid) {
          setJobAddress(undefined);
          setWorkflowError("The saved escrow state could not be verified on-chain. No new escrow was created.");
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [jobAddress, metadataCid]);

  function updateDraft(field: Exclude<keyof FormDraft, "milestones">, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateMilestone(id: string, field: keyof Omit<MilestoneDraft, "id">, value: string) {
    setDraft((current) => ({ ...current, milestones: current.milestones.map((milestone) => milestone.id === id ? { ...milestone, [field]: value } : milestone) }));
  }

  function persistRecovery(nextCid: string, nextJobAddress?: Address) {
    if (nextJobAddress) isRecoveringNavigationState.current = false;
    setMetadataCid(nextCid);
    setJobAddress(nextJobAddress);
    navigate(".", { replace: true, state: { metadataCid: nextCid, jobAddress: nextJobAddress } satisfies NewJobLocationState });
  }

  async function runWorkflow() {
    if (!canWrite || !address || isSubmitting) return;
    setWorkflowError(undefined);
    const validation = validateDraft(draft, createdAtRef.current);
    setErrors(validation.errors);
    if (!validation.metadata || !validation.amounts || validation.total === undefined) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    setIsSubmitting(true);
    const fingerprint = draftFingerprint(validation.metadata);
    let cid = metadataCid;
    try {
      if (!cid || pinnedMetadata.current.get(fingerprint) !== cid) {
        const previousCid = pinnedMetadata.current.get(fingerprint);
        if (previousCid) {
          cid = previousCid;
        } else {
          setStage("metadata");
          setProgressDetail("Pinning the canonical job metadata to IPFS…");
          const pinned = await uploadJobMetadata(validation.metadata);
          cid = pinned.cid;
          pinnedMetadata.current.set(fingerprint, cid);
        }
        persistRecovery(cid);
      }
    } catch (error) {
      setStage("error");
      setWorkflowError(errorMessage(error, "metadata"));
      setIsSubmitting(false);
      return;
    }

    let confirmedAddress = jobAddress;
    if (!confirmedAddress) {
      try {
        setStage("create");
        setProgressDetail("Confirm escrow creation in your wallet.");
        const created = await runCreate({
          writeContract: async (request) => {
            const hash = await writeContractAsync(request as never);
            setHashes((current) => ({ ...current, create: hash }));
            setProgressDetail("Escrow creation submitted. Waiting for the GIWA receipt…");
            return hash;
          },
          waitForReceipt: publicClient.waitForTransactionReceipt,
          factory: giwaAddresses.jobFactory,
          request: {
            address: giwaAddresses.jobFactory,
            abi: JobFactoryAbi,
            functionName: "createJob",
            args: [validation.amounts, cid],
            chainId: 91342,
          },
        });
        confirmedAddress = created.jobAddress;
        setHashes((current) => ({ ...current, create: created.hash }));
        persistRecovery(cid!, confirmedAddress);
      } catch (error) {
        setStage("error");
        setWorkflowError(errorMessage(error, "create"));
        setIsSubmitting(false);
        return;
      }
    }

    let allowance = 0n;
    try {
      allowance = await publicClient.readContract({
        address: giwaAddresses.mockUsdc,
        abi: MockUSDCAbi,
        functionName: "allowance",
        args: [address, confirmedAddress],
      });
    } catch {
      // Approval is safe to request again; the receipt remains the source of truth for funding.
    }
    if (allowance < validation.total) {
      try {
        setStage("approve");
        setProgressDetail("Confirm the exact MockUSDC approval in your wallet.");
        const approved = await runApprove({
          writeContract: async (request) => {
            const hash = await writeContractAsync(request as never);
            setHashes((current) => ({ ...current, approve: hash }));
            setProgressDetail("Approval submitted. Waiting for the GIWA receipt…");
            return hash;
          },
          waitForReceipt: publicClient.waitForTransactionReceipt,
          request: {
            address: giwaAddresses.mockUsdc,
            abi: MockUSDCAbi,
            functionName: "approve",
            args: [confirmedAddress, validation.total],
            chainId: 91342,
          },
        });
        setHashes((current) => ({ ...current, approve: approved.hash }));
      } catch (error) {
        setStage("error");
        setWorkflowError(errorMessage(error, "approve"));
        setIsSubmitting(false);
        return;
      }
    }

    try {
      setStage("fund");
      setProgressDetail("Confirm funding in your wallet.");
      const funded = await runFund({
        writeContract: async (request) => {
          const hash = await writeContractAsync(request as never);
          setHashes((current) => ({ ...current, fund: hash }));
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
      setHashes((current) => ({ ...current, fund: funded.hash }));
      setStage("complete");
      setProgressDetail("Funding receipt confirmed. The escrow is available on-chain.");
      await invalidateJobQueries(queryClient, { jobAddress: confirmedAddress, accounts: [address] });
    } catch (error) {
      setStage("error");
      setWorkflowError(errorMessage(error, "fund"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const retryingMetadata = stage === "error" && !jobAddress && workflowError?.startsWith("Metadata upload failed") === true;
  const actionLabel = retryingMetadata ? "Retry metadata upload" : jobAddress && stage !== "complete" ? "Finish funding" : "Create and fund escrow";

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
          <input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-300" id="job-title" value={draft.title} maxLength={100} disabled={Boolean(jobAddress)} aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? "job-title-error" : undefined} onChange={(event) => updateDraft("title", event.target.value)} />
          {errors.title ? <p id="job-title-error" className="new-job-error">{errors.title}</p> : null}
          <label htmlFor="job-description">Job description</label>
          <textarea className="mt-1 min-h-32 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-300" id="job-description" value={draft.description} maxLength={4000} disabled={Boolean(jobAddress)} aria-invalid={errors.description ? true : undefined} aria-describedby={errors.description ? "job-description-error" : undefined} onChange={(event) => updateDraft("description", event.target.value)} />
          {errors.description ? <p id="job-description-error" className="new-job-error">{errors.description}</p> : null}
          <label htmlFor="job-skills">Skills</label>
          <input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-300" id="job-skills" value={draft.skills} disabled={Boolean(jobAddress)} aria-invalid={errors.skills ? true : undefined} aria-describedby={errors.skills ? "job-skills-error job-skills-help" : "job-skills-help"} onChange={(event) => updateDraft("skills", event.target.value)} />
          <p id="job-skills-help" className="new-job-helper">Separate up to 10 skills with commas. Each skill can be 1–32 characters.</p>
          {errors.skills ? <p id="job-skills-error" className="new-job-error">{errors.skills}</p> : null}
        </section>

        <MilestoneEditor
          milestones={draft.milestones}
          errors={errors}
          onChange={updateMilestone}
          onAdd={() => setDraft((current) => current.milestones.length >= 10 ? current : { ...current, milestones: [...current.milestones, initialMilestone()] })}
          onRemove={(id) => setDraft((current) => current.milestones.length <= 1 ? current : { ...current, milestones: current.milestones.filter((milestone) => milestone.id !== id) })}
          disabled={Boolean(jobAddress)}
        />

        <section className="new-job-submit card-glass rounded-xl p-5 sm:p-6" aria-label="Escrow funding">
          <p className="dashboard-overline">Escrow amount</p>
          <p className="new-job-total">Total escrow: {formatUnits(liveTotal, 6)} USDC</p>
          {errors.total || errors.form ? <p className="new-job-error" role="alert">{errors.total ?? errors.form}</p> : null}
          <p className="new-job-helper">MockUSDC is approved for this exact total, then transferred only after the approval receipt confirms.</p>
          {jobAddress ? <p className="new-job-address">Escrow address: <code>{jobAddress}</code></p> : null}
          <button className="btn-primary new-job-submit-button" type="submit" disabled={!canWrite || isSubmitting}>
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
