import fs from "fs";
import { join } from "path";
export function detectCorruption(manager, jobId) {
  const corrupted = [];
  const requiredFields = ["id", "jobId", "fromState", "toState", "actor", "timestamp"];

  // Read raw journal file to catch entries without jobId
  const journalPath = join(manager.registry.registryDir, "journal.jsonl");
  const content = fs.readFileSync(journalPath, "utf-8");

  for (const line of content.trim().split("\n")) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line);

      // Only check entries for manager job or entries without jobId (which could be corrupted)
      if (entry.jobId && entry.jobId !== jobId) continue;

      for (const field of requiredFields) {
        if (!(field in entry)) {
          corrupted.push({ entryId: entry.id, missingField: field });
        }
      }

      // Check for invalid state values
      const validStates = [
        "queued",
        "dispatch-pending",
        "implementing",
        "verification-pending",
        "verifying",
        "review-pending",
        "reviewing",
        "sync-required",
        "syncing",
        "publication-pending",
        "pr-open",
        "ci-pending",
        "merge-ready",
        "merged",
        "blocked",
        "cancelled",
      ];

      if (
        entry.fromState &&
        entry.toState &&
        (!validStates.includes(entry.fromState) || !validStates.includes(entry.toState))
      ) {
        corrupted.push({ entryId: entry.id, reason: "Invalid state value" });
      }
    } catch {
      // Malformed JSON - manager is corruption
      corrupted.push({ entryId: "unknown", reason: "Malformed JSON" });
    }
  }

  return corrupted;
}
