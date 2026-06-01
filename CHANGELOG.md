# Changelog

## 0.2.4 - 2026-06-01

- Added `glimpse version` plus `-v`/`--version` support for printing the CLI version.
- Updated the npm playground to test against the published 0.2.3 package.

## 0.2.3 - 2026-06-01

- Documented the dual UPPT and manual release flows for agents.
- Enabled the release workflow to create UPPT release PRs from pushes to `main`.
- Limited Bun test discovery to the main `test` directory so playground tests do not run in CI.

## 0.2.1 - 2026-05-29

- Switched the release workflow from staged npm publishing to direct trusted `npm publish`.
- Updated the Bun setup action to a Node.js 24-compatible pinned release.

## 0.2.0 - 2026-05-29

- Added the initial Glimpse CLI for opening, prompting, updating, and controlling persistent UI windows.
- Added file watch support for HTML windows.
- Hardened daemon startup and liveness recovery, including stale socket handling and serialized autostart.
- Fixed CLI option handling, missing-window waits, and iframe URL escaping.
- Added bundled Node release output, release smoke tests, project skills, and staged npm trusted publishing via GitHub Actions.
