---
# glimpse-cli-pj3z
title: Evaluate seamless HMR for watched Glimpse windows
status: todo
type: task
priority: deferred
tags:
    - future
    - hmr
created_at: 2026-05-26T16:04:48Z
updated_at: 2026-05-26T16:04:48Z
---

Explore whether watch mode can evolve from full HTML reloads to seamless hot module replacement for persistent Glimpse windows. Consider embedding or integrating Vite, Rolldown, or a similar dev-server/bundler pipeline.

Context:
- Current watch mode should fully reload/replace HTML on file changes.
- Future goal is preserving more page state and enabling smoother UI iteration.

Questions to answer:
- Can HMR be added without making the daemon heavy or always-on?
- Should HMR be opt-in separate from --watch?
- What dependencies/runtime cost are acceptable?
- How should failures fall back to full reload?
