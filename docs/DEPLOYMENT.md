# Deployment (web portal)

The web portal lives in `apps/web-portal` and is deployed by Vercel as the project
`iypm`, serving <https://iypm.vercel.app/>.

## Where the project root is configured

In the Vercel dashboard, **not in the repository**:

> Project `iypm` → Settings → Build & Development Settings → **Root Directory** =
> `apps/web-portal`

That is the only supported way to point a monorepo project at a subdirectory.
`apps/web-portal/vercel.json` then supplies the build settings
(`buildCommand`, `outputDirectory`, `installCommand`).

## Why there is no root `vercel.json`

There used to be one, containing `"rootDirectory": "apps/web-portal"`. `rootDirectory`
is a project setting, not a `vercel.json` property, and the project-config schema sets
`additionalProperties: false` — so every deployment failed before building anything:

```
The `vercel.json` schema validation failed with the following message:
should NOT have additional property `rootDirectory`
```

That error red-flagged every commit on `main` and every pull request. The file is gone
and `packages/build-tools/verify-vercel-config.js` (wired into `npm run check`) rejects
it if it comes back.

## Checking a deployment

```bash
gh run list --branch main --limit 5     # CI
vercel ls iypm                          # needs an authenticated CLI: vercel login
vercel inspect <deployment-url> --logs
```

Vercel's GitHub check is not a required status check on `main`: a red Vercel does not
block merges, so it must be watched deliberately. It is currently the only signal that
the portal is deployable.

## Skipping portal builds

`apps/web-portal/vercel.json` sets:

```json
"ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."
```

Vercel runs the command from the Root Directory (`apps/web-portal`), so `.` scopes the
diff to the portal. Exit 0 skips the build, exit 1 builds. Extension, docs and CI-only
pushes no longer queue a portal deployment — and no longer send a deployment email.

Checked against real history before it was added: the three commits that touched
`apps/web-portal` build, the rest skip.

**Caveat — required checks.** Vercel is a required status check on `main`, and a skipped
deployment does not produce a normal successful build. `next` therefore keeps Vercel
non-required, and the behaviour of a skip on `main` was verified separately before
relying on it. If a skipped deployment ever leaves the check unresolved, drop Vercel from
`main`'s required checks — the alternative is a release PR that can never merge because
nothing needed deploying.

## Portal build

```bash
cd apps/web-portal
npm ci && npm run build      # Next.js
npm run test:e2e             # Playwright, loads the built extension
```
