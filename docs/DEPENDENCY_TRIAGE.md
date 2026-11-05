# Dependency advisory triage

Owner: repository maintainer. Verification runner: Hermes, per owner instruction.

Run `npm run audit:all` from the repository root. It audits all three lockfile trees,
including a separate production-only view. It writes advisory details, dependency
paths, and available fixes to `dist/verification/dependency-audit.json`. It does not
install or upgrade anything. A high/critical advisory returns a failing exit status;
registry/network failures are errors rather than an empty successful report.

The last executed editor install, before this implementation, reported 18 advisories
(2 low, 15 moderate, 1 high). Exact packages, exploit paths and fixed versions must be
established from fresh advisory data. Do not report those advisories as resolved from
a successful root-only audit. No fresh audit has been run in this implementation pass.

For each finding, record:

| Finding                        | Tree and dependency path | Runtime or build-only                | Reachability and impact | Smallest compatible fix     | Owner      | Verification |
| ------------------------------ | ------------------------ | ------------------------------------ | ----------------------- | --------------------------- | ---------- | ------------ |
| Pending Hermes advisory report | All three trees          | Separate production results provided | Needs assessment        | Do not force major upgrades | Maintainer | Pending      |

Prefer a compatible direct dependency update, then a compatible parent update for a
transitive dependency. An override needs a documented compatibility reason and focused
verification; do not silence advisories by changing severity thresholds. Use npm 10.8.2
for lockfile regeneration, preserve the existing release changes, and keep Playwright
versions aligned across root and portal trees. Rerun audit and the relevant build/test
gates after remediation. Security fixes may need a separate focused branch before merge.
