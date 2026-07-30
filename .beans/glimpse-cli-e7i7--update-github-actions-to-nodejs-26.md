---
# glimpse-cli-e7i7
title: Update GitHub Actions to Node.js 26
status: in-progress
type: task
priority: normal
created_at: 2026-07-30T08:30:54Z
updated_at: 2026-07-30T08:32:52Z
---

Update CI toolchain configuration to Node.js 26 and remove deprecated Node.js 20 action runtimes where supported.

- [x] Audit workflow Node versions and pinned action runtimes
- [x] Update compatible actions and Node.js setup versions
- [x] Validate workflow syntax and project checks
- [ ] Commit, push, and verify GitHub Actions

## Audit notes

GitHub JavaScript actions currently support a Node.js 24 action runtime, not Node.js 26. Configure Node.js 26 for repository scripts while upgrading pinned actions to their current Node.js 24-runtime releases. This removes the deprecated upload-artifact Node.js 20 runtime warning.
