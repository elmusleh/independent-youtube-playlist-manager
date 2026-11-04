import {
  acknowledgePushedCandidates,
  runAdapterPass,
  type AdapterPassContext,
  type AdapterPassResult,
} from "./sync-engine-adapters";
import type { DirtyCandidate } from "./sync/adapters/types";
import { pullAll, pushAll, type PushResult } from "./sync/relay-transport";

export type PushResolution = {
  failed: string[];
  appliedCount: number;
  maxSeq: number;
  cursorBlocked: boolean;
  didPushSuccessfully: boolean;
  pulledCount: number;
};

const recordKey = (record: { collection: string; rid: string }) =>
  `${record.collection}|${record.rid}`;

export async function pushCandidatesWithConflictResolution(
  context: AdapterPassContext,
  initial: AdapterPassResult
): Promise<PushResolution> {
  const outcome: PushResolution = {
    failed: [],
    appliedCount: 0,
    maxSeq: initial.maxSeq,
    cursorBlocked: false,
    didPushSuccessfully: false,
    pulledCount: 0,
  };
  if (!initial.allDirty.length) return outcome;

  const pushResults = await pushAll(
    context.relayConfig,
    context.space,
    context.authHash,
    initial.allDirty
  );
  outcome.didPushSuccessfully = pushResults.some((result) => result.status === "ok");

  const conflicts = pushResults.filter((result) => result.status === "conflict");
  const conflictKeys = new Set(conflicts.map(recordKey));
  const conflictCandidates = initial.dirtyCandidates.filter((candidate) =>
    conflictKeys.has(recordKey(candidate.record))
  );
  const acknowledgedCandidates = initial.dirtyCandidates.filter(
    (candidate) => !conflictKeys.has(recordKey(candidate.record))
  );
  outcome.failed.push(
    ...(await acknowledgePushedCandidates(
      acknowledgedCandidates,
      pushResults.filter((result) => !conflictKeys.has(recordKey(result))),
      context.localDeviceId
    ))
  );

  for (const conflict of conflicts) {
    if (
      !conflictCandidates.some((candidate) => recordKey(candidate.record) === recordKey(conflict))
    ) {
      outcome.failed.push(
        `${conflict.collection}/${conflict.rid}: conflict has no local candidate`
      );
    }
  }
  if (!conflicts.length) return outcome;

  const remote = await pullAll(
    context.relayConfig,
    context.space,
    context.authHash,
    context.sinceSeq
  );
  outcome.pulledCount = remote.length;
  const remoteKeys = new Set(remote.map(recordKey));
  for (const candidate of conflictCandidates) {
    if (!remoteKeys.has(recordKey(candidate.record))) {
      outcome.failed.push(
        `${candidate.collection}/${candidate.recordId}: conflict record missing from relay pull`
      );
    }
  }

  const merged = await runAdapterPass({ ...context, incoming: remote });
  outcome.appliedCount = merged.appliedCount;
  outcome.maxSeq = merged.maxSeq;
  outcome.cursorBlocked = merged.cursorBlocked;
  outcome.failed.push(...merged.failed);

  const retryByKey = new Map(
    merged.dirtyCandidates.map((candidate) => [recordKey(candidate.record), candidate])
  );
  const retryCandidates: DirtyCandidate[] = conflictCandidates
    .filter((candidate) => remoteKeys.has(recordKey(candidate.record)))
    .map((candidate) => retryByKey.get(recordKey(candidate.record)))
    .filter((candidate): candidate is DirtyCandidate => candidate !== undefined);

  // Only hold back retry candidates whose apply actually failed. Unrelated
  // failures (for example a different collection) must not block a clean retry.
  const isApplyFailure = (failure: string) => !failure.toLowerCase().includes("shadow");
  const blockedRetryCandidates = retryCandidates.filter((candidate) =>
    merged.failed.some((failure) => {
      if (!isApplyFailure(failure)) return false;
      return (
        failure.includes(candidate.record.rid) ||
        new RegExp(`^${candidate.collection}(?:\\s|:)`).test(failure)
      );
    })
  );

  if (blockedRetryCandidates.length > 0) {
    outcome.failed.push(
      ...blockedRetryCandidates.map(
        (candidate) =>
          `${candidate.collection}/${candidate.recordId}: conflict retry held because remote apply failed`
      )
    );
  }

  const pushableRetryCandidates = retryCandidates.filter(
    (candidate) => !blockedRetryCandidates.includes(candidate)
  );

  if (pushableRetryCandidates.length > 0) {
    const retryResults: PushResult[] = await pushAll(
      context.relayConfig,
      context.space,
      context.authHash,
      pushableRetryCandidates.map((candidate) => candidate.record)
    );
    outcome.didPushSuccessfully ||= retryResults.some((result) => result.status === "ok");
    outcome.failed.push(
      ...(await acknowledgePushedCandidates(
        pushableRetryCandidates,
        retryResults,
        context.localDeviceId
      ))
    );
  }

  return outcome;
}
