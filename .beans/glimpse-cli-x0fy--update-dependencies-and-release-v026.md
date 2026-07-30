---
# glimpse-cli-x0fy
title: Update dependencies and release v0.2.6
status: completed
type: task
priority: normal
created_at: 2026-07-30T08:16:29Z
updated_at: 2026-07-30T08:30:16Z
---

Update safe runtime and development dependencies, validate the package, restore the UPPT release PR flow, and publish the next patch release.

- [x] Update selected dependencies and lockfile
- [x] Run typecheck, lint, formatting checks, tests, build, and package smoke validation
- [x] Commit and push dependency updates
- [x] Restore GitHub Actions release PR creation and create the v0.2.6 release PR
- [x] Merge the release PR and verify GitHub/npm publication

## Release follow-up

- [x] Correct binary workflow test scoping and attach release binaries

## Summary of Changes

Updated the selected runtime and development dependencies, restored GitHub Actions release-PR permissions, released glimpse-cli 0.2.6 to npm, corrected binary workflow test scoping, embedded the package version in compiled executables, and attached validated macOS ARM64, Linux ARM64, and Linux x64 binaries to the GitHub release.
