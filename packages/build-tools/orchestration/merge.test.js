import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { evaluateMergeAuthority, performGuardedSquashMerge } from "./merge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const basePolicy = JSON.parse(readFileSync(resolve(__dirname, "policy.json"), "utf-8"));

const validEvidence = { status: "valid", problems: [] };
const validReview = { decision: "ready-for-guarded-merge", blockers: [], head: "abc123" };
const effectiveProtections = {
  requiredChecks: ["verify"],
  requiredApprovals: 1,
  allowsAdminBypass: false,
  requiresUpToDate: true,
};

function guardedPolicy(overrides = {}) {
  return {
    ...basePolicy,
    mergeMode: "guarded",
    jobAuthority: {
      ...basePolicy.jobAuthority,
      merge: { ...basePolicy.jobAuthority.merge, requiresOwnerOptIn: true, ownerOptIn: true },
    },
    ...overrides,
  };
}

function validState(overrides = {}) {
  return {
    policy: guardedPolicy(),
    job: { id: "job-1", mergeOptIn: true, target: "next" },
    target: "next",
    evidenceState: validEvidence,
    reviewState: validReview,
    protections: effectiveProtections,
    ...overrides,
  };
}

describe("Merge - guarded path is disabled by default", () => {
  it("refuses while mergeMode is manual", () => {
    const authority = evaluateMergeAuthority(validState({ policy: basePolicy }));
    expect(authority.allowed).toBe(false);
    expect(authority.blockers.map((b) => b.code)).toContain("GUARDED_MERGE_DISABLED");
  });

  it("refuses without a recorded per-job owner opt-in", () => {
    const authority = evaluateMergeAuthority(validState({ job: { id: "job-1", target: "next" } }));
    expect(authority.allowed).toBe(false);
    expect(authority.blockers.map((b) => b.code)).toContain("MERGE_NOT_AUTHORIZED");
  });

  it("refuses when the policy itself does not require owner opt-in", () => {
    const policy = guardedPolicy();
    policy.jobAuthority.merge.requiresOwnerOptIn = false;
    const authority = evaluateMergeAuthority(validState({ policy }));
    expect(authority.allowed).toBe(false);
    expect(authority.blockers.map((b) => b.code)).toContain("MERGE_NOT_AUTHORIZED");
  });
});

describe("Merge - target and evidence gates", () => {
  it("refuses main and release targets", () => {
    for (const target of ["main", "release/1.0", "production"]) {
      const authority = evaluateMergeAuthority(validState({ target }));
      expect(authority.allowed).toBe(false);
      expect(authority.blockers.map((b) => b.code)).toContain("PROTECTED_TARGET");
    }
  });

  it("refuses stale evidence", () => {
    const authority = evaluateMergeAuthority(
      validState({ evidenceState: { status: "stale", problems: [{ code: "STALE_HEAD" }] } })
    );
    expect(authority.blockers.map((b) => b.code)).toContain("STALE_EVIDENCE");
  });

  it("refuses when the review is not ready", () => {
    const authority = evaluateMergeAuthority(
      validState({
        reviewState: { decision: "blocked", blockers: [{ code: "UNRESOLVED_THREADS" }] },
      })
    );
    expect(authority.blockers.map((b) => b.code)).toContain("REVIEW_NOT_READY");
  });

  it("refuses failing CI", () => {
    const authority = evaluateMergeAuthority(
      validState({
        reviewState: {
          decision: "blocked",
          blockers: [{ code: "CHECKS_FAILED" }],
        },
      })
    );
    expect(authority.blockers.map((b) => b.code)).toContain("REVIEW_NOT_READY");
  });
});

describe("Merge - protections must be effective", () => {
  const cases = [
    ["missing protections", null],
    ["no required checks", { ...effectiveProtections, requiredChecks: [] }],
    ["no required approvals", { ...effectiveProtections, requiredApprovals: 0 }],
    ["admin bypass allowed", { ...effectiveProtections, allowsAdminBypass: true }],
    ["branch not required up to date", { ...effectiveProtections, requiresUpToDate: false }],
  ];

  for (const [label, protections] of cases) {
    it(`refuses when protections are ineffective: ${label}`, () => {
      const authority = evaluateMergeAuthority(validState({ protections }));
      expect(authority.allowed).toBe(false);
      expect(authority.blockers.map((b) => b.code)).toContain("INEFFECTIVE_PROTECTIONS");
    });
  }

  it("allows only when every gate passes", () => {
    const authority = evaluateMergeAuthority(validState());
    expect(authority.allowed).toBe(true);
    expect(authority.blockers).toEqual([]);
  });
});

describe("Merge - squashing is one pinned operation", () => {
  it("does not call the service when authority is refused", async () => {
    const service = { squashMerge: vi.fn() };
    const result = await performGuardedSquashMerge({
      service,
      repository: "owner/repo",
      number: 9,
      expectedHead: "abc123",
      authority: { allowed: false, blockers: [{ code: "GUARDED_MERGE_DISABLED" }] },
    });

    expect(result.merged).toBe(false);
    expect(result.status).toBe("refused");
    expect(service.squashMerge).not.toHaveBeenCalled();
  });

  it("squash-merges once with the expected head", async () => {
    const service = {
      squashMerge: vi.fn(async () => ({ merged: true, sha: "merge-sha" })),
    };
    const result = await performGuardedSquashMerge({
      service,
      repository: "owner/repo",
      number: 9,
      expectedHead: "abc123",
      authority: { allowed: true, blockers: [] },
      commitTitle: "feat: squash",
    });

    expect(result.merged).toBe(true);
    expect(result.method).toBe("squash");
    expect(result.mergeCommit).toBe("merge-sha");
    expect(service.squashMerge).toHaveBeenCalledTimes(1);
    expect(service.squashMerge).toHaveBeenCalledWith({
      repository: "owner/repo",
      number: 9,
      expectedHead: "abc123",
      commitTitle: "feat: squash",
    });
  });

  it("reports a service failure without claiming a merge", async () => {
    const service = {
      squashMerge: async () => {
        throw new Error("head moved");
      },
    };
    const result = await performGuardedSquashMerge({
      service,
      repository: "owner/repo",
      number: 9,
      expectedHead: "abc123",
      authority: { allowed: true, blockers: [] },
    });

    expect(result.merged).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("head moved");
  });

  it("reports an unconfirmed merge as failed", async () => {
    const service = { squashMerge: async () => ({ merged: false, message: "locked" }) };
    const result = await performGuardedSquashMerge({
      service,
      repository: "owner/repo",
      number: 9,
      expectedHead: "abc123",
      authority: { allowed: true, blockers: [] },
    });

    expect(result.merged).toBe(false);
    expect(result.reason).toBe("locked");
  });
});

describe("Merge - incomplete safety data fails closed", () => {
  it.each([{}, { decision: "unknown" }, { decision: "ready-for-manual-merge", blockers: [] }])(
    "refuses non-guarded review %j",
    (reviewState) => {
      expect(evaluateMergeAuthority(validState({ reviewState })).allowed).toBe(false);
    }
  );
  it.each(["allowsAdminBypass", "requiresUpToDate", "requiredChecks", "requiredApprovals"])(
    "refuses missing protection %s",
    (field) => {
      const protections = { ...effectiveProtections };
      delete protections[field];
      expect(evaluateMergeAuthority(validState({ protections })).allowed).toBe(false);
    }
  );
});
