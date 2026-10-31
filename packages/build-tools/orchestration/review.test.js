import { describe, it, expect } from "vitest";
import {
  Blocker,
  MergeMode,
  ReviewStateError,
  evaluateGuardedMerge,
  evaluateReviewState,
  protectionFromGitHub,
} from "./review.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const policy = JSON.parse(readFileSync(resolve(__dirname, "policy.json"), "utf-8"));

const HEAD = "abc123";

function baseState(overrides = {}) {
  return {
    head: HEAD,
    base: "next",
    pr: { number: 9, headSha: HEAD, base: "next", draft: false, mergeable: true },
    checks: [{ name: "verify", status: "completed", conclusion: "success" }],
    reviews: [{ author: "reviewer", state: "APPROVED", commitId: HEAD }],
    unresolvedThreads: 0,
    requiredChecks: ["verify"],
    policy,
    author: "implementer",
    ...overrides,
  };
}

describe("Review - readiness bound to head and base", () => {
  it("is merge-ready but manual for a fully reviewed head", () => {
    const state = evaluateReviewState(baseState());
    expect(state.decision).toBe("ready-for-manual-merge");
    expect(state.mergeMode).toBe(MergeMode.MANUAL);
    expect(state.mergePerformed).toBe(false);
    expect(state.automatedMerge).toBe(false);
    expect(state.blockers).toEqual([]);
  });

  it("blocks when the head changed after review", () => {
    const state = evaluateReviewState(baseState({ head: "def456" }));
    expect(state.decision).toBe("blocked");
    expect(state.blockers.map((b) => b.code)).toEqual(
      expect.arrayContaining([Blocker.HEAD_CHANGED, Blocker.STALE_REVIEW])
    );
  });

  it("blocks when the base is not next", () => {
    const state = evaluateReviewState(
      baseState({ pr: { number: 9, headSha: HEAD, base: "main", draft: false, mergeable: true } })
    );
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.WRONG_BASE);
  });

  it("blocks unknown mergeability", () => {
    const state = evaluateReviewState(
      baseState({ pr: { number: 9, headSha: HEAD, base: "next", draft: false, mergeable: null } })
    );
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.UNKNOWN_MERGEABILITY);
  });

  it("blocks a conflicting PR", () => {
    const state = evaluateReviewState(
      baseState({
        pr: { number: 9, headSha: HEAD, base: "next", draft: false, mergeable: "conflicting" },
      })
    );
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.MERGE_CONFLICT);
  });

  it("blocks a draft PR", () => {
    const state = evaluateReviewState(
      baseState({ pr: { number: 9, headSha: HEAD, base: "next", draft: true, mergeable: true } })
    );
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.DRAFT_PR);
  });
});

describe("Review - review and thread state", () => {
  it("blocks author-only approval", () => {
    const state = evaluateReviewState(
      baseState({ reviews: [{ author: "implementer", state: "APPROVED", commitId: HEAD }] })
    );
    expect(state.decision).toBe("blocked");
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.AUTHOR_ONLY_APPROVAL);
  });

  it("requires a non-author review when the policy says so", () => {
    const state = evaluateReviewState(baseState({ reviews: [] }));
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.NON_AUTHOR_REVIEW_REQUIRED);
  });

  it("blocks unresolved threads", () => {
    const state = evaluateReviewState(baseState({ unresolvedThreads: 2 }));
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.UNRESOLVED_THREADS);
  });

  it("blocks a stale approval from an earlier commit", () => {
    const state = evaluateReviewState(
      baseState({ reviews: [{ author: "reviewer", state: "APPROVED", commitId: "oldsha" }] })
    );
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.STALE_REVIEW);
  });
});

describe("Review - CI checks", () => {
  const withChecks = (checks) => evaluateReviewState(baseState({ checks }));

  it("blocks a failed required check", () => {
    const state = withChecks([{ name: "verify", status: "completed", conclusion: "failure" }]);
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.CHECKS_FAILED);
  });

  it("blocks a pending required check", () => {
    const state = withChecks([{ name: "verify", status: "in_progress", conclusion: null }]);
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.CHECKS_PENDING);
  });

  it("blocks a skipped required check", () => {
    const state = withChecks([{ name: "verify", status: "completed", conclusion: "skipped" }]);
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.CHECKS_SKIPPED);
  });

  it("blocks a required check that never ran", () => {
    const state = withChecks([]);
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.CHECKS_PENDING);
  });

  it("ignores non-required checks", () => {
    const state = withChecks([
      { name: "verify", status: "completed", conclusion: "success" },
      { name: "optional-lint", status: "completed", conclusion: "failure" },
    ]);
    expect(state.decision).toBe("ready-for-manual-merge");
  });

  it("blocks when a required merge queue is unsupported", () => {
    const state = evaluateReviewState(
      baseState({ requiredQueue: "repo-merge-queue", mergeQueueSupported: false })
    );
    expect(state.blockers.map((b) => b.code)).toContain(Blocker.MERGE_QUEUE_UNSUPPORTED);
  });
});

describe("Review - merge stays manual", () => {
  it("refuses guarded merge while the policy is manual", () => {
    const result = evaluateGuardedMerge({ mergeMode: MergeMode.MANUAL, ...baseState() });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("GUARDED_MERGE_DISABLED");
  });

  it("reports readiness without merging when guarded mode is opted in", () => {
    const guardedPolicy = {
      ...policy,
      mergeMode: MergeMode.GUARDED,
      jobAuthority: {
        ...policy.jobAuthority,
        merge: { ...policy.jobAuthority.merge, requiresOwnerOptIn: true, ownerOptIn: true },
      },
    };
    const result = evaluateGuardedMerge({
      mergeMode: MergeMode.GUARDED,
      ...baseState({ policy: guardedPolicy }),
    });

    expect(result.allowed).toBe(true);
    expect(result.state.decision).toBe("ready-for-guarded-merge");
    expect(result.state.mergePerformed).toBe(false);
    expect(result.note).toMatch(/no merge is performed/i);
  });

  it("blocks guarded merge without explicit owner opt-in", () => {
    const guardedPolicy = {
      ...policy,
      mergeMode: MergeMode.GUARDED,
      jobAuthority: {
        ...policy.jobAuthority,
        merge: { ...policy.jobAuthority.merge, requiresOwnerOptIn: true },
      },
    };
    const result = evaluateGuardedMerge({
      mergeMode: MergeMode.GUARDED,
      ...baseState({ policy: guardedPolicy }),
    });
    expect(result.allowed).toBe(false);
  });

  it("requires a PR to evaluate", () => {
    expect(() => evaluateReviewState(baseState({ pr: null }))).toThrow(ReviewStateError);
  });
});

const PROTECTION = {
  required_status_checks: { strict: false, contexts: ["Quality & Security (Lint, Format)"] },
  required_pull_request_reviews: { required_approving_review_count: 0 },
  required_conversation_resolution: { enabled: true },
  enforce_admins: { enabled: false },
};

describe("Review - server branch protections", () => {
  it("maps the fields readiness depends on", () => {
    const protection = protectionFromGitHub(PROTECTION);

    expect(protection.complete).toBe(true);
    expect(protection.requiredChecks).toEqual(["Quality & Security (Lint, Format)"]);
    expect(protection.requireConversationResolution).toBe(true);
    expect(protection.enforceAdmins).toBe(false);
    expect(protection.allowsAdminBypass).toBe(true);
    expect(protection.requiredApprovals).toBe(0);
  });

  it("treats a missing rule as unknown instead of absent", () => {
    const incomplete = protectionFromGitHub({
      required_status_checks: { strict: false, contexts: ["verify"] },
      enforce_admins: { enabled: true },
    });

    expect(incomplete.complete).toBe(false);
    expect(incomplete.missing).toEqual(["required_conversation_resolution.enabled"]);
  });

  it("fails closed with PROTECTIONS_UNKNOWN when the rules are incomplete", () => {
    const state = evaluateReviewState(
      baseState({
        protection: { complete: false, base: "next", missing: ["enforce_admins.enabled"] },
      })
    );

    expect(state.decision).toBe("blocked");
    expect(state.blockers.map((blocker) => blocker.code)).toContain(Blocker.PROTECTIONS_UNKNOWN);
    expect(state.blockers.find((b) => b.code === Blocker.PROTECTIONS_UNKNOWN).detail).toContain(
      "enforce_admins.enabled"
    );
  });

  it("fails closed when no protection data is supplied and it is required", () => {
    const state = evaluateReviewState(baseState({ requireProtection: true }));

    expect(state.blockers.map((blocker) => blocker.code)).toContain(Blocker.PROTECTIONS_UNKNOWN);
  });

  it("uses the server rule set for required checks", () => {
    const state = evaluateReviewState(
      baseState({
        checks: [{ name: "verify", status: "completed", conclusion: "success" }],
        protection: protectionFromGitHub(PROTECTION),
      })
    );

    expect(state.blockers.map((blocker) => blocker.code)).toContain(Blocker.CHECKS_PENDING);
    expect(state.requiredChecks).toContain("Quality & Security (Lint, Format)");
  });

  it("requires the number of non-author approvals the branch demands", () => {
    const protectedWithReview = {
      ...PROTECTION,
      required_pull_request_reviews: { required_approving_review_count: 2 },
    };
    const state = evaluateReviewState(
      baseState({ protection: protectionFromGitHub(protectedWithReview) })
    );

    expect(state.decision).toBe("blocked");
    expect(state.blockers.map((blocker) => blocker.code)).toContain(
      Blocker.NON_AUTHOR_REVIEW_REQUIRED
    );
  });

  it("only blocks admin bypass when the policy forbids it", () => {
    const protection = protectionFromGitHub(PROTECTION);
    const allowed = evaluateReviewState(baseState({ protection }));
    expect(allowed.blockers.map((blocker) => blocker.code)).not.toContain(
      Blocker.PROTECTIONS_UNKNOWN
    );

    const forbidden = evaluateReviewState(
      baseState({ protection, policy: { ...policy, requireAdminEnforcement: true } })
    );
    expect(forbidden.blockers.map((blocker) => blocker.code)).toContain(
      Blocker.PROTECTIONS_UNKNOWN
    );
  });
});
