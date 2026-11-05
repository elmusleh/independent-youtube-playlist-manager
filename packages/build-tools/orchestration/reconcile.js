#!/usr/bin/env node
/**
 * Publication reconciliation.
 *
 * Remote effects are uncertain: a push or PR create can succeed and still lose its
 * response. Recovery always observes the remote state (branch head / existing PR by
 * repository+head+base) before repeating a write, so a crash cannot duplicate a PR or
 * publish another job's branch.
 */

export class ReconcileError extends Error {
  constructor(message, code, detail = {}) {
    super(message);
    this.name = "ReconcileError";
    this.code = code;
    this.detail = detail;
  }
}

export const PendingReason = {
  RATE_LIMITED: "rate-limited",
  TIMEOUT: "timeout",
  TRANSPORT: "transport-error",
  AMBIGUOUS_PR: "ambiguous-pr",
};

/**
 * Classify a GitHub/HTTP failure. Only known-transient failures are retryable.
 */
export function classifyFailure(error) {
  const status = error?.status ?? error?.response?.status;
  const message = String(error?.message || "").toLowerCase();

  if (status === 429 || message.includes("rate limit") || message.includes("secondary rate")) {
    return { retryable: true, reason: PendingReason.RATE_LIMITED };
  }
  if (
    status === 408 ||
    status === 504 ||
    message.includes("timeout") ||
    message.includes("etimedout")
  ) {
    return { retryable: true, reason: PendingReason.TIMEOUT };
  }
  if (
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up")
  ) {
    return { retryable: true, reason: PendingReason.TRANSPORT };
  }
  return { retryable: false, reason: "permanent" };
}

/**
 * Bounded retry with injectable sleep, so tests never wait on real backoff.
 */
export async function withBoundedRetry(
  fn,
  { attempts = 3, baseDelayMs = 10, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}
) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return { status: "ok", value: await fn(), attempts: attempt };
    } catch (error) {
      lastError = error;
      const classified = classifyFailure(error);
      if (!classified.retryable || attempt === attempts) {
        return {
          status: "pending",
          reason: classified.reason,
          error,
          attempts: attempt,
          pendingAction: classified.retryable
            ? "retry-later-or-manual-review"
            : "manual-intervention",
        };
      }
      await sleep(baseDelayMs * attempt);
    }
  }

  return { status: "pending", reason: "unknown", error: lastError, attempts };
}

/**
 * Discover exactly one PR for repository/head/base.
 */
export async function discoverPr({ github, repository, head, base = "next" }) {
  const found = await github.findPr({ repository, head, base });
  const candidates = Array.isArray(found) ? found : found ? [found] : [];

  const matching = candidates.filter(
    (pr) =>
      pr && pr.head === head && pr.base === base && (!pr.repository || pr.repository === repository)
  );

  if (matching.length > 1) {
    throw new ReconcileError(
      `Multiple PRs found for ${repository} ${head} -> ${base}`,
      PendingReason.AMBIGUOUS_PR,
      { numbers: matching.map((pr) => pr.number) }
    );
  }

  return matching[0] || null;
}

/**
 * Reconcile publication after an uncertain push or PR response.
 *
 * `observedRemoteHead` is the branch head read back from the remote. It must equal the
 * local head before a PR is created or updated — this is what prevents publishing
 * another job's commit.
 */
export async function reconcilePublication({
  github,
  repository,
  head,
  base = "next",
  localHead,
  observedRemoteHead,
  title,
  body,
  retry = {},
}) {
  if (!observedRemoteHead || observedRemoteHead !== localHead) {
    throw new ReconcileError(
      `Remote branch head ${observedRemoteHead || "(missing)"} does not match local head ${localHead}`,
      "HEAD_MISMATCH"
    );
  }

  const discovery = await withBoundedRetry(
    () => discoverPr({ github, repository, head, base }),
    retry
  );
  if (discovery.status !== "ok") {
    return {
      status: "pending",
      stage: "discover",
      reason: discovery.reason,
      pendingAction: discovery.pendingAction,
    };
  }

  const existing = discovery.value;
  if (existing) {
    if (existing.head && existing.head !== head) {
      throw new ReconcileError(
        `Existing PR #${existing.number} belongs to head '${existing.head}', not '${head}'`,
        "FOREIGN_HEAD"
      );
    }
    if (existing.headSha && existing.headSha !== localHead) {
      throw new ReconcileError(
        `Existing PR #${existing.number} points at ${existing.headSha}, not the published head ${localHead}`,
        "FOREIGN_HEAD"
      );
    }
    const update = await withBoundedRetry(
      () =>
        github.updatePr({
          repository,
          number: existing.number,
          title: title ?? existing.title,
          body: body ?? existing.body,
          draft: true,
        }),
      retry
    );
    if (update.status !== "ok") {
      return {
        status: "pending",
        stage: "update",
        reason: update.reason,
        pendingAction: update.pendingAction,
        pr: existing,
      };
    }
    return { status: "updated", created: false, pr: update.value || existing };
  }

  // Create exactly once. Retrying a create blindly could duplicate a PR whose response
  // was lost, so a failure is followed by discovery, never by another create.
  let createValue = null;
  let createFailure = null;
  try {
    createValue = await github.createPr({
      repository,
      head,
      base,
      title,
      body,
      draft: true,
    });
  } catch (error) {
    createFailure = error;
  }

  if (createValue) {
    return { status: "created", created: true, pr: createValue };
  }

  // The create may have succeeded server-side and lost its response. Re-discover once
  // before reporting pending: a found PR means success, not a duplicate.
  const recheck = await withBoundedRetry(
    () => discoverPr({ github, repository, head, base }),
    retry
  );
  if (recheck.status === "ok" && recheck.value) {
    return {
      status: "reconciled",
      created: false,
      pr: recheck.value,
      note: "create response was lost; existing PR discovered",
    };
  }

  const classified = classifyFailure(createFailure);
  return {
    status: "pending",
    stage: "create",
    reason: classified.reason,
    pendingAction: classified.retryable ? "retry-later-or-manual-review" : "manual-intervention",
  };
}
