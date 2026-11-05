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
 *
 * Branch protection for the PR's base branch is read from GitHub and fed into the readiness
 * gates; `--no-protection` opts out explicitly for an unprotected branch.
 */

import { execFileSync } from "child_process";
import fs from "fs";
import { dirname } from "path";
import { evaluateReviewState, protectionFromGitHub } from "./review.js";

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

/** Split a checklist on commas or semicolons, ignoring separators inside parentheses. */
export function parseRequiredChecks(value = "") {
  const text = String(value || "").trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      return JSON.parse(text)
        .map((name) => String(name).trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
  const names = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if ((char === "," || char === ";") && depth === 0) {
      names.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  names.push(current.trim());
  return names.filter(Boolean);
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

/**
 * Read the effective rule set for the base branch. Anything unreadable is reported as
 * incomplete so readiness fails closed instead of assuming a permissive branch.
 */
export function readBranchProtection(repo, base, run = gh) {
  try {
    const raw = JSON.parse(
      run(["api", `repos/${repo}/branches/${encodeURIComponent(base)}/protection`])
    );
    return protectionFromGitHub(raw, { base });
  } catch (error) {
    const stderr = String(error?.stderr || error?.message || "")
      .trim()
      .split("\n")[0];
    return {
      complete: false,
      base,
      missing: ["branch protection endpoint"],
      error: stderr || "unreadable",
    };
  }
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
  const requiredChecks = parseRequiredChecks(value("--required-checks"));
  const unresolvedThreads = unresolvedThreadCount(repo, Number(prNumber));
  const skipProtection = args.includes("--no-protection");
  const protection = skipProtection ? null : readBranchProtection(repo, prView.baseRefName);

  const input = mapGhPr(prView, {
    requiredChecks,
    unresolvedThreads,
    author: prView.author?.login,
  });
  const readiness = evaluateReviewState({
    ...input,
    protection,
    requireProtection: !skipProtection,
  });

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
      requiredChecks: readiness.requiredChecks || requiredChecks,
      protection,
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
