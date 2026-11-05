export function runRecoveryCLI(recovery) {
  const command = process.argv[2];
  async function run() {
    switch (command) {
      case "resume": {
        const results = await recovery.resumeFromJournal();
        console.log(JSON.stringify(results, null, 2));
        break;
      }
      case "reconcile": {
        const results = await recovery.reconcileUncertainOperations();
        console.log(JSON.stringify(results, null, 2));
        break;
      }
      case "status": {
        const status = recovery.getRecoveryStatus();
        console.log(JSON.stringify(status, null, 2));
        break;
      }
      case "reassign": {
        const jobId = process.argv[3];
        const newSessionId = process.argv[4];
        const newPid = parseInt(process.argv[5]);
        const newLivenessRef = process.argv[6];
        const reason = process.argv[7] || "manual-reassignment";
        const authorizedBy = process.argv[8];

        const result = await recovery.reassignLease(
          jobId,
          newSessionId,
          newPid,
          newLivenessRef,
          reason,
          authorizedBy
        );
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case "cancel": {
        const jobId = process.argv[3];
        const sessionId = process.argv[4];
        const reason = process.argv[5] || "user-requested";

        const result = await recovery.cancelJob(jobId, sessionId, reason);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      default: {
        console.error("Usage: recovery.js <resume|reconcile|status|reassign|cancel>");
        process.exit(1);
      }
    }
  }

  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
