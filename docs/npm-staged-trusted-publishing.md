# npm staged trusted publishing

This package uses [`danielroe/uppt`](https://github.com/danielroe/uppt) for npm Trusted Publishing plus staged publishing.

## One-time setup

`glimpse-cli` must exist on npm before its Trusted Publisher can be configured. If it is not published yet, create the placeholder package:

```bash
npx --yes setup-npm-trusted-publish glimpse-cli
```

Then open:

```text
https://www.npmjs.com/package/glimpse-cli/access
```

Configure the Trusted Publisher:

- Provider: GitHub Actions
- Repository: `bjesuiter/glimpse-cli`
- Workflow filename: `release.yml`
- Environment name: `npm`
- Allowed action: `npm stage publish`

Also configure GitHub:

1. Create a GitHub environment named `npm`.
2. In repo Settings → Actions → General → Workflow permissions, enable “Allow GitHub Actions to create and approve pull requests”.

Prefer stage-only npm access so CI can submit a release candidate, but a maintainer still approves the final publication with 2FA.

## Release flow

1. Use conventional commits on `main`.
2. On push to `main`, `uppt/pr` opens or updates a draft `release/vX.Y.Z` PR.
3. Merge the release PR.
4. `uppt/release` creates the tag and GitHub Release, then dispatches `release.yml` on the tag.
5. `uppt/pack` creates the tarball from a Bun-checked build artifact.
6. `uppt/publish` runs `npm stage publish` with OIDC.
7. Approve or reject the staged package on npmjs.com or with an interactive npm CLI session.

No `NPM_TOKEN` secret is required. The publish job uses GitHub Actions OIDC via `permissions.id-token: write`.
