# Project instructions

## Release process

This repo supports two release paths.

### Preferred: UPPT-style release PR flow

- Push changes to `main`; the release workflow runs `danielroe/uppt/pr` to create or update a release PR.
- Merge the `release/v*` PR; the release workflow runs `danielroe/uppt/release` to create the Git tag and GitHub release.
- The pushed `v*` tag triggers packaging and direct npm publishing through GitHub Actions.
- Publishing uses `npm publish --provenance --ignore-scripts --access public`, not npm staged publishing.
- Keep npm trusted publishing configured for direct publish, with GitHub Actions OIDC enabled.
- The `npm` GitHub environment may be used as a final approval gate before publishing.

### Manual local release flow

Use this when intentionally bypassing the UPPT release PR flow.

- Update the package version in `package.json`. If the user did not specify patch, minor, or major, ask.
- Check commits since the last release tag and generate a concise entry in `CHANGELOG.md`.
- Check that the project lints, tests, and builds.
- Commit the release changes.
- Tag the commit with the version number prefixed by `v`.
- Create the GitHub release for that tag, using the changelog entry as release notes.
- Push code and tags.

Pushing the `v*` tag triggers the GitHub Actions packaging and direct npm publish jobs.
