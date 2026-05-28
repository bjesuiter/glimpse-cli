---
# glimpse-cli-zbfv
title: Evaluate global event awaiting across windows
status: todo
type: task
priority: deferred
tags:
    - future
    - events
created_at: 2026-05-26T16:11:00Z
updated_at: 2026-05-26T16:11:00Z
---

Evaluate whether glimpse-cli should support waiting for Window Events across all open Windows, e.g. `glimpse wait --any`.

Current v1 direction:
- `wait`, `read`, `events`, and `peek` require `-w/--window <ref>`.
- Scripts consume events from a specific Window queue.

Potential benefits:
- Supervisors/agents could listen for whichever UI the user interacts with first.
- Multi-window workflows could coordinate without polling each Window separately.
- Could enable global command palettes or notification centers.

Potential issues:
- Need event multiplexing output with source window metadata.
- Ordering across Window queues must be defined.
- Consuming global events could surprise per-window waiters.
- More complex filtering and fairness semantics.
- Harder script reasoning and debugging.

Questions to answer:
- Should global wait consume events from source queues?
- Should it include close events/tombstones?
- Should filters support window name/id, event type, or both?
- Is polling multiple windows good enough for v1/v2?
