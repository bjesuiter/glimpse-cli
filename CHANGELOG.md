# Changelog

## 0.2.1 - 2026-05-29

- Switched the release workflow from staged npm publishing to direct trusted `npm publish`.
- Updated the Bun setup action to a Node.js 24-compatible pinned release.

## 0.2.0 - 2026-05-29

- Added the initial Glimpse CLI for opening, prompting, updating, and controlling persistent UI windows.
- Added file watch support for HTML windows.
- Hardened daemon startup and liveness recovery, including stale socket handling and serialized autostart.
- Fixed CLI option handling, missing-window waits, and iframe URL escaping.
- Added bundled Node release output, release smoke tests, project skills, and staged npm trusted publishing via GitHub Actions.
