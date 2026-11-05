const fs = require("node:fs");
class RequiredReporter {
  onBegin(_config, suite) {
    this.suite = suite;
    this.versions = new Set();
  }
  onTestEnd(_test, result) {
    for (const item of result.attachments)
      if (item.name === "extension-browser-version" && item.body)
        this.versions.add(item.body.toString());
  }
  onEnd() {
    const tests = this.suite
      .allTests()
      .filter((test) => /[/\\]extension\.spec\.ts$/.test(test.location.file));
    const skipped = tests.filter((test) => test.outcome() === "skipped").length;
    const executed = tests.filter((test) =>
      test.results.some((result) => result.status !== "skipped")
    ).length;
    const passed = tests.filter(
      (test) => test.expectedStatus === "passed" && ["expected", "flaky"].includes(test.outcome())
    ).length;
    const mandatoryPassed = tests.length > 0 && skipped === 0 && passed === tests.length;
    const summary = {
      total: tests.length,
      executed,
      skipped,
      passed,
      mandatoryPassed,
      browserVersions: [...this.versions],
    };
    if (process.env.IYPM_VERIFICATION_E2E_REPORT)
      fs.writeFileSync(
        process.env.IYPM_VERIFICATION_E2E_REPORT,
        JSON.stringify(summary, null, 2) + "\n",
        { mode: 0o600 }
      );
    if (process.env.IYPM_REQUIRE_EXTENSION_E2E === "1" && !mandatoryPassed) {
      console.error(`Mandatory extension E2E incomplete: ${JSON.stringify(summary)}`);
      return { status: "failed" };
    }
  }
}
module.exports = RequiredReporter;
