# Project instructions

## Release process

How to cut an npm package release:

- Update the package version in `package.json`. If the user did not specify patch, minor, or major, ask.
- Check commits since the last release tag and generate a concise entry in `CHANGELOG.md`.
- Check that the project lints, tests, and builds.
- Commit the release changes.
- Tag the commit with the version number prefixed by `v`, then push code and tags.
