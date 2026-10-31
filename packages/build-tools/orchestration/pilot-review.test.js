import { describe, expect, it } from "vitest";
import { mapGhPr, parseRequiredChecks } from "./pilot-review.js";
import { evaluateReviewState } from "./review.js";

const prView = {
  number: 52,
  url: "https://github.com/elmusleh/independent-youtube-playlist-manager/pull/52",
  isDraft: true,
  baseRefName: "next",
  headRefName: "feat/orchestration-coordinator",
  headRefOid: "abc123",
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  reviewDecision: "",
  author: { login: "el-musleh" },
  reviews: [],
  statusCheckRollup: [
    { name: "ci", status: "COMPLETED", conclusion: "FAILURE" },
    { context: "test-web", state: "SUCCESS" },
    { name: "analyze", status: "IN_PROGRESS", conclusion: "" },
  ],
};

describe("Pilot review mapping", () => {
  it("maps CheckRun and StatusContext entries into one check shape", () => {
    const input = mapGhPr(prView, { requiredChecks: ["ci", "test-web"] });
    const byName = Object.fromEntries(input.checks.map((check) => [check.name, check]));

    expect(byName.ci).toEqual({ name: "ci", status: "completed", conclusion: "failure" });
    expect(byName["test-web"]).toEqual({
      name: "test-web",
      status: "completed",
      conclusion: "success",
    });
    expect(byName.analyze).toEqual({ name: "analyze", status: "in_progress", conclusion: "" });
  });

  it("reports a failed required check as blocking", () => {
    const input = mapGhPr(prView, { requiredChecks: ["ci"] });
    const readiness = evaluateReviewState(input);

    expect(readiness.decision).toBe("blocked");
    expect(readiness.blockers.map((blocker) => blocker.code)).toContain("CHECKS_FAILED");
  });

  it("keeps a draft PR blocked even with green required checks", () => {
    const green = {
      ...prView,
      isDraft: true,
      statusCheckRollup: [{ name: "ci", status: "COMPLETED", conclusion: "SUCCESS" }],
    };
    const readiness = evaluateReviewState(mapGhPr(green, { requiredChecks: ["ci"] }));

    expect(readiness.decision).toBe("blocked");
    expect(readiness.blockers.map((blocker) => blocker.code)).toContain("DRAFT_PR");
  });

  it("reports a ready manual merge once the draft flag is cleared", () => {
    const ready = {
      ...prView,
      isDraft: false,
      statusCheckRollup: [{ name: "ci", status: "COMPLETED", conclusion: "SUCCESS" }],
    };
    const readiness = evaluateReviewState(mapGhPr(ready, { requiredChecks: ["ci"] }));

    expect(readiness.decision).toBe("ready-for-manual-merge");
    expect(readiness.automatedMerge).toBe(false);
    expect(readiness.mergePerformed).toBe(false);
  });

  it("counts only approvals from non-authors and invalidates stale ones", () => {
    const reviewed = {
      ...prView,
      isDraft: false,
      reviews: [
        { author: { login: "reviewer" }, state: "APPROVED", commit: { oid: "abc123" } },
        { author: { login: "other" }, state: "APPROVED", commit: { oid: "older" } },
        { author: { login: "third" }, state: "CHANGES_REQUESTED", commit: { oid: "abc123" } },
      ],
    };
    const readiness = evaluateReviewState(mapGhPr(reviewed));

    expect(readiness.approvals).toBe(2);
    expect(readiness.blockers.map((blocker) => blocker.code)).toContain("STALE_REVIEW");
  });

  it("treats unknown mergeability as blocking", () => {
    const unknown = { ...prView, mergeable: "UNKNOWN", isDraft: false };
    const readiness = evaluateReviewState(mapGhPr(unknown));

    expect(readiness.blockers.map((blocker) => blocker.code)).toContain("UNKNOWN_MERGEABILITY");
  });
});

describe("Required check parsing", () => {
  it("keeps parenthesised names intact when splitting on commas", () => {
    expect(
      parseRequiredChecks("Quality & Security (Lint, Format, Audit, Unit Tests),Extension CI")
    ).toEqual(["Quality & Security (Lint, Format, Audit, Unit Tests)", "Extension CI"]);
  });

  it("accepts a semicolon or JSON list", () => {
    expect(parseRequiredChecks("a;b")).toEqual(["a", "b"]);
    expect(parseRequiredChecks('["a","b"]')).toEqual(["a", "b"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseRequiredChecks("")).toEqual([]);
    expect(parseRequiredChecks(undefined)).toEqual([]);
    expect(parseRequiredChecks("[not json")).toEqual([]);
  });
});
