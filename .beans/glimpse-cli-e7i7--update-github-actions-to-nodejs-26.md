---
# glimpse-cli-e7i7
title: Update GitHub Actions to Node.js 26
status: completed
type: task
priority: normal
created_at: 2026-07-30T08:30:54Z
updated_at: 2026-07-30T08:34:17Z
---

Update CI toolchain configuration to Node.js 26 and remove deprecated Node.js 20 action runtimes where supported.

- [x] Audit workflow Node versions and pinned action runtimes
- [x] Update compatible actions and Node.js setup versions
- [x] Validate workflow syntax and project checks
- [x] Commit, push, and verify GitHub Actions

## Audit notes

GitHub JavaScript actions currently support a Node.js 24 action runtime, not Node.js 26. Configure Node.js 26 for repository scripts while upgrading pinned actions to their current Node.js 24-runtime releases. This removes the deprecated upload-artifact Node.js 20 runtime warning.

## Summary of Changes

Configured release scripts and npm publishing to use Node.js 26, upgraded checkout and setup-node to v7, upgraded upload-artifact to v7 to remove its deprecated Node.js 20 runtime, upgraded UPPT to v0.5.5, retained current Node.js 24-runtime actions where that is the newest GitHub-supported action runtime, and verified all three binary jobs without the deprecation warning.
