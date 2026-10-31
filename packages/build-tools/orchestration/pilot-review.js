#!/usr/bin/env node
/**
 * Pilot review: evaluate real GitHub PR state with the same readiness gates the coordinator
 * uses, and record exactly what blocks or allows a manual merge.
 *
 * Read-only with respect to GitHub: it calls `gh pr view` and one GraphQL query for
 * unresolved review threads. It never merges, approves, comments or pushes.
 *
 * Usage:
 *   node pilot-review.js --pr 52 [--required-checks "ci,test-web"] [--out <file>]
 */

import { execFileSync } from "child_process";
import fs from "fs";
import { dirname } from "path";
import { evaluateReviewState } from "./review.js";

const GH_FIELDS = [
  "number",
  "url",
  "isDraft",
  "baseRefName",
  "headRefName",
  "headRefOid",
  "mergeable",
  "mergeStateStatus",
  "reviewDecision",
  "author",
  "reviews",
  "statusCheckRollup",
].join(",");

/** Map `gh pr view --json` output onto the readiness input shape. */
export function mapGhPr(prView, { author, requiredChecks = [], unresolvedThreads = 0 } = {}) {
  const checks = (prView.statusCheckRollup || []).map((check) => {
    const name = check.name || check.context || "(unnamed)";
    if (check.status) {
      return {
        name,
        status: String(check.status).toLowerCase(),
        conclusion: check.conclusion ? String(check.conclusion).toLowerCase() : "",
      };
    }
    const state = String(check.state || "").toLowerCase();
    return {
      name,
      status:
        state === "success" || state === "failure" || state === "error"
          ? "completed"
          : "in_progress",
      conclusion: state === "expected" || state === "pending" ? "" : state,
    };
  });

  const reviews = (prView.reviews || [])
    .filter((review) => review && review.state)
    .map((review) => ({
      author: review.author?.login || null,
      state: String(review.state).toUpperCase(),
      commitId: review.commit?.oid || null,
    }));

  return {
    head: prView.headRefOid,
    base: prView.baseRefName,
    pr: {
      number: prView.number,
      url: prView.url,
      headSha: prView.headRefOid,
      base: prView.baseRefName,
      mergeable: prView.mergeable,
      draft: prView.isDraft === true,
    },
    checks,
    reviews,
    unresolvedThreads,
    requiredChecks,
    author: author || prView.author?.login || null,
    policy: { mergeMode: "manual" },
  };
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf-8", stdio: "pipe" }).trim();
}

function unresolvedThreadCount(repo, number) {
  const query = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved}}}}}`;
  const [owner, name] = repo.split("/");
  const raw = gh([
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-f",
    `owner=${owner}`,
    "-f",
    `name=${name}`,
    "-F",
    `number=${number}`,
  ]);
  const parsed = JSON.parse(raw);
  const threads = parsed.data?.repository?.pullRequest?.reviewThreads?.nodes || [];
  return threads.filter((thread) => thread.isResolved !== true).length;
}

function main() {
  const args = process.argv.slice(2);
  const value = (flag) => {
    const index = args.indexOf(flag);
    return index > -1 ? args[index + 1] : null;
  };

  const prNumber = value("--pr");
  if (!prNumber) {
    console.error("Usage: node pilot-review.js --pr <number> [--required-checks a,b] [--out file]");
    process.exit(1);
  }

  const repo = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  const prView = JSON.parse(gh(["pr", "view", prNumber, "--repo", repo, "--json", GH_FIELDS]));
  const requiredChecks = (value("--required-checks") || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const unresolvedThreads = unresolvedThreadCount(repo, Number(prNumber));

  const input = mapGhPr(prView, {
    requiredChecks,
    unresolvedThreads,
    author: prView.author?.login,
  });
  const readiness = evaluateReviewState(input);

  const report = {
    task: "7.4",
    generatedAt: new Date().toISOString(),
    repository: repo,
    remoteMutation: "none (read-only gh calls)",
    pr: {
      number: prView.number,
      url: prView.url,
      draft: prView.isDraft === true,
      base: prView.baseRefName,
      head: prView.headRefName,
      headSha: prView.headRefOid,
      mergeable: prView.mergeable,
      mergeStateStatus: prView.mergeStateStatus,
      reviewDecision: prView.reviewDecision,
      author: prView.author?.login || null,
    },
    observed: {
      checks: input.checks,
      approvals: input.reviews.filter((review) => review.state === "APPROVED").length,
      unresolvedThreads,
      requiredChecks,
    },
    readiness,
    mergePerformed: false,
  };

  const json = JSON.stringify(report, null, 2);
  const outPath = value("--out");
  if (outPath) {
    fs.mkdirSync(dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json + "\n");
  }
  console.log(json);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
