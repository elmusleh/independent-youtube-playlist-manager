/* eslint-disable no-console */
/**
 * Capture constants — shared constants for capture controller.
 */

/**
 * Job states for tracking in-flight operations.
 * @readonly
 * @enum {string}
 */
export const JobState = {
  PENDING: "pending",
  COLLECTING: "collecting",
  ENRICHING: "enriching",
  SAVING: "saving",
  CLOSING: "closing",
  COMPLETED: "completed",
  FAILED: "failed",
};

export default { JobState };
