import { describe, it, expect } from "vitest";
import {
  PendingReason,
  classifyFailure,
  discoverPr,
  reconcilePublication,
  withBoundedRetry,
} from "./reconcile.js";

function rateLimitError() {
  const error = new Error("API rate limit exceeded");
  error.status = 429;
  return error;
}

function timeoutError() {
  return new Error("socket timeout after 30000ms");
}

/**
 * Fake GitHub that keeps server-side state, so a "lost response" is a real duplicate
 * risk rather than an artificial one.
 */
function statefulGithub({ failCreateAfterStore = 0, failFindTimes = 0, prs = [] } = {}) {
  const state = { prs: [...prs], nextNumber: 100, createCalls: 0, updateCalls: 0, findCalls: 0 };
  let findFailures = failFindTimes;
  let createFailures = failCreateAfterStore;

  return {
    state,
    async findPr({ repository, head, base }) {
      state.findCalls += 1;
      if (findFailures > 0) {
        findFailures -= 1;
        throw timeoutError();
      }
      return state.prs.filter(
        (pr) => pr.repository === repository && pr.head === head && pr.base === base
      );
    },
    async createPr(request) {
      state.createCalls += 1;
      const pr = { number: state.nextNumber++, ...request, draft: true };
      state.prs.push(pr);
      if (createFailures > 0) {
        createFailures -= 1;
        throw timeoutError();
      }
      return pr;
    },
    async updatePr(request) {
      state.updateCalls += 1;
      const pr = state.prs.find((entry) => entry.number === request.number);
      Object.assign(pr, { title: request.title, body: request.body, draft: true });
      return pr;
    },
  };
}

const noSleep = { sleep: async () => {}, baseDelayMs: 1 };

describe("Reconcile - failure classification and bounded retry", () => {
  it("classifies rate limits and timeouts as retryable", () => {
    expect(classifyFailure(rateLimitError())).toEqual({
      retryable: true,
      reason: PendingReason.RATE_LIMITED,
    });
    expect(classifyFailure(timeoutError())).toEqual({
      retryable: true,
      reason: PendingReason.TIMEOUT,
    });
  });

  it("does not retry permanent failures", () => {
    expect(classifyFailure(new Error("Validation Failed")).retryable).toBe(false);
  });

  it("retries a rate limit and then succeeds", async () => {
    let attempts = 0;
    const result = await withBoundedRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw rateLimitError();
        return "ok";
      },
      { attempts: 3, ...noSleep }
    );

    expect(result.status).toBe("ok");
    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(3);
  });

  it("reports pending after exhausting retries", async () => {
    const result = await withBoundedRetry(
      async () => {
        throw rateLimitError();
      },
      { attempts: 2, ...noSleep }
    );

    expect(result.status).toBe("pending");
    expect(result.reason).toBe(PendingReason.RATE_LIMITED);
    expect(result.pendingAction).toBe("retry-later-or-manual-review");
  });
});

describe("Reconcile - PR discovery by repository/head/base", () => {
  it("finds the PR matching the exact head and base", async () => {
    const github = statefulGithub({
      prs: [
        { number: 1, repository: "owner/repo", head: "feat/other", base: "next" },
        { number: 2, repository: "owner/repo", head: "feat/job-1", base: "main" },
        { number: 3, repository: "owner/repo", head: "feat/job-1", base: "next" },
      ],
    });

    const pr = await discoverPr({
      github,
      repository: "owner/repo",
      head: "feat/job-1",
      base: "next",
    });
    expect(pr.number).toBe(3);
  });

  it("reports ambiguity instead of picking one", async () => {
    const github = statefulGithub({
      prs: [
        { number: 1, repository: "owner/repo", head: "feat/job-1", base: "next" },
        { number: 2, repository: "owner/repo", head: "feat/job-1", base: "next" },
      ],
    });

    await expect(
      discoverPr({ github, repository: "owner/repo", head: "feat/job-1", base: "next" })
    ).rejects.toMatchObject({ code: PendingReason.AMBIGUOUS_PR });
  });
});

describe("Reconcile - crash after push", () => {
  it("creates the PR once when the remote head matches the local head", async () => {
    const github = statefulGithub();
    const result = await reconcilePublication({
      github,
      repository: "owner/repo",
      head: "feat/job-1",
      base: "next",
      localHead: "abc123",
      observedRemoteHead: "abc123",
      title: "Feature",
      body: "Body",
      retry: noSleep,
    });

    expect(result.status).toBe("created");
    expect(github.state.createCalls).toBe(1);
    expect(github.state.prs).toHaveLength(1);
  });

  it("refuses to publish when the remote head is another job's commit", async () => {
    const github = statefulGithub();
    await expect(
      reconcilePublication({
        github,
        repository: "owner/repo",
        head: "feat/job-1",
        base: "next",
        localHead: "abc123",
        observedRemoteHead: "def456",
        title: "Feature",
        body: "Body",
        retry: noSleep,
      })
    ).rejects.toMatchObject({ code: "HEAD_MISMATCH" });
    expect(github.state.createCalls).toBe(0);
  });

  it("does not create a PR twice on resume after the first PR exists", async () => {
    const github = statefulGithub();
    const args = {
      github,
      repository: "owner/repo",
      head: "feat/job-1",
      base: "next",
      localHead: "abc123",
      observedRemoteHead: "abc123",
      title: "Feature",
      body: "Body",
      retry: noSleep,
    };

    const first = await reconcilePublication(args);
    const resumed = await reconcilePublication(args);

    expect(first.status).toBe("created");
    expect(resumed.status).toBe("updated");
    expect(github.state.createCalls).toBe(1);
    expect(github.state.prs).toHaveLength(1);
    expect(github.state.updateCalls).toBe(1);
  });
});

describe("Reconcile - lost PR response never duplicates", () => {
  it("reconciles a create whose response was lost", async () => {
    const github = statefulGithub({ failCreateAfterStore: 1 });
    const result = await reconcilePublication({
      github,
      repository: "owner/repo",
      head: "feat/job-1",
      base: "next",
      localHead: "abc123",
      observedRemoteHead: "abc123",
      title: "Feature",
      body: "Body",
      retry: { attempts: 2, ...noSleep },
    });

    expect(result.status).toBe("reconciled");
    expect(result.created).toBe(false);
    expect(github.state.prs).toHaveLength(1);
    expect(github.state.createCalls).toBeGreaterThanOrEqual(1);
  });

  it("recovers from a transient discovery failure before creating", async () => {
    const github = statefulGithub({ failFindTimes: 1 });
    const result = await reconcilePublication({
      github,
      repository: "owner/repo",
      head: "feat/job-1",
      base: "next",
      localHead: "abc123",
      observedRemoteHead: "abc123",
      title: "Feature",
      body: "Body",
      retry: { attempts: 3, ...noSleep },
    });

    expect(result.status).toBe("created");
    expect(github.state.prs).toHaveLength(1);
  });

  it("reports pending (not a duplicate) when discovery stays unavailable", async () => {
    const github = statefulGithub({ failFindTimes: 99 });
    const result = await reconcilePublication({
      github,
      repository: "owner/repo",
      head: "feat/job-1",
      base: "next",
      localHead: "abc123",
      observedRemoteHead: "abc123",
      title: "Feature",
      body: "Body",
      retry: { attempts: 2, ...noSleep },
    });

    expect(result.status).toBe("pending");
    expect(result.stage).toBe("discover");
    expect(result.pendingAction).toBe("retry-later-or-manual-review");
    expect(github.state.createCalls).toBe(0);
  });

  it("refuses an existing PR that points at a different head commit", async () => {
    const github = statefulGithub({
      prs: [
        {
          number: 5,
          repository: "owner/repo",
          head: "feat/job-1",
          base: "next",
          title: "Stale",
          headSha: "oldsha",
        },
      ],
    });

    await expect(
      reconcilePublication({
        github,
        repository: "owner/repo",
        head: "feat/job-1",
        base: "next",
        localHead: "abc123",
        observedRemoteHead: "abc123",
        title: "Feature",
        body: "Body",
        retry: noSleep,
      })
    ).rejects.toMatchObject({ code: "FOREIGN_HEAD" });
    expect(github.state.createCalls).toBe(0);
    expect(github.state.updateCalls).toBe(0);
  });
});
