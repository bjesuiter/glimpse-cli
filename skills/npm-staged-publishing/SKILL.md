---
name: npm-staged-publishing
description: Set up or operate npm Trusted Publishing with OIDC and staged publishing using danielroe/uppt. Use when configuring npm release workflows, replacing NPM_TOKEN, creating first placeholder packages, running npm stage publish, or approving staged npm releases.
---

# npm staged trusted publishing with uppt

Fast path for npm releases without long-lived tokens using `danielroe/uppt`: GitHub Actions creates release PRs from conventional commits, tags merged release PRs, packs an artifact, runs `npm stage publish` through OIDC, then a maintainer approves the staged package with 2FA in npm.

Reference action: https://github.com/danielroe/uppt

Pinned version used here: `danielroe/uppt/*@e4a14cf018abc126b709938c2c2c61d62b6d859e`.

Do not replace `uppt` with a hand-written `npm publish` workflow unless the user explicitly asks. Workflow files must be YAML even though the user generally dislikes YAML.

## Why uppt

Use the `uppt` split-pack/publish model:

- lifecycle scripts and dependency install happen in the unprivileged `pack` job
- OIDC/environment permission only exists in the `publish` job
- publish job stage-publishes a prebuilt tarball with `--ignore-scripts`

`uppt/pack` supports npm/pnpm/yarn installation, not Bun. For Bun projects, install Bun/dependencies and run checks before `uppt/pack`, then pass `install: false` and `checkout: false`.

## Local project setup

This repo uses `.github/workflows/release.yml` with `danielroe/uppt`.

Manual external setup still required:

1. npm package access settings: trusted publisher workflow filename `release.yml`, environment `npm`, allowed action `npm stage publish`.
2. GitHub repo settings: Actions → General → Workflow permissions → enable “Allow GitHub Actions to create and approve pull requests”.
3. GitHub environment: create environment `npm`; optional scope to `v*` tags and require approvals.

## How the workflow behaves

- Push to `main`: `uppt/pr` opens or updates a draft `release/vX.Y.Z` PR from conventional commits.
- Merge release PR: `uppt/release` tags `vX.Y.Z`, creates GitHub Release, dispatches the same workflow on the tag.
- Workflow dispatch on a `v*` tag: pack job installs/checks/builds with Bun and `uppt/pack`; publish job runs `uppt/publish`, which executes `npm stage publish <tarball> --provenance --ignore-scripts --access=public`.

## First package / dummy placeholder

npm currently needs the package to exist before package settings can configure Trusted Publishing. If the package is not published yet, create a placeholder first:

```bash
npx --yes setup-npm-trusted-publish <package-name>
```

Then open:

```text
https://www.npmjs.com/package/<package-name>/access
```

Configure Trusted Publisher:

- Provider: GitHub Actions
- Repository: `<owner>/<repo>`
- Workflow filename: `release.yml`
- Environment name: `npm`
- Allowed action: `npm stage publish` only, unless the user explicitly wants direct publish

## Approval

After CI stages a package, approve it via npmjs.com or local npm CLI with a logged-in maintainer account and 2FA. OIDC does not approve stages.
