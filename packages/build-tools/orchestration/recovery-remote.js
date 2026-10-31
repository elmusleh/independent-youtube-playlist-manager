import { execSync } from "child_process";

export async function reconcilePush(manager, job, _receipt) {
  try {
    const output = execSync(`git ls-remote origin ${job.branch}`, {
      cwd: manager.registry.repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    if (output) {
      const remoteSha = output.split("\t")[0];
      return {
        status: "confirmed",
        remoteSha,
        action: "update-receipt-status",
      };
    } else {
      return {
        status: "not-found",
        action: "retry-push",
      };
    }
  } catch (err) {
    return {
      status: "error",
      error: err.message,
      action: "manual-review",
    };
  }
}

export async function reconcilePrCreate(manager, job, _receipt) {
  try {
    // Try to find PR by head branch
    const output = execSync(`gh pr list --head ${job.branch} --json number,url,state --limit 1`, {
      cwd: manager.registry.repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    if (output && output !== "[]") {
      const prs = JSON.parse(output);
      if (prs.length > 0) {
        return {
          status: "confirmed",
          prNumber: prs[0].number,
          prUrl: prs[0].url,
          action: "update-receipt-status",
        };
      }
    }

    return {
      status: "not-found",
      action: "retry-pr-create",
    };
  } catch (err) {
    return {
      status: "error",
      error: err.message,
      action: "manual-review",
    };
  }
}

export async function reconcilePrUpdate(manager, job, _receipt) {
  return manager.reconcilePrCreate(job, _receipt);
}

export async function reconcileMergeRequest(manager, job, _receipt) {
  try {
    const output = execSync(
      `gh pr list --head ${job.branch} --json number,state,merged --limit 1`,
      {
        cwd: manager.registry.repoRoot,
        encoding: "utf-8",
        stdio: "pipe",
      }
    ).trim();

    if (output && output !== "[]") {
      const prs = JSON.parse(output);
      if (prs.length > 0) {
        const pr = prs[0];
        if (pr.merged) {
          return {
            status: "merged",
            prNumber: pr.number,
            action: "update-job-state",
          };
        }
      }
    }

    return {
      status: "not-merged",
      action: "retry-merge",
    };
  } catch (err) {
    return {
      status: "error",
      error: err.message,
      action: "manual-review",
    };
  }
}
