---
# glimpse-cli-v65i
title: Evaluate Glimpse open/prompt skills
status: completed
type: task
priority: normal
created_at: 2026-05-28T21:10:37Z
updated_at: 2026-05-28T21:12:47Z
---

Evaluate creating two Pi/agent skills for glimpse-cli usage: one focused on open mode and one focused on prompt mode. Goal: give agents clear hints and examples for using the CLI correctly, including when to use each mode, expected event patterns, and safe shell snippets.

## Drafts

Drafted two repo-local skills:

- `skills/glimpse-open/SKILL.md` for persistent windows, event loops, updates, and page/agent messaging.
- `skills/glimpse-prompt/SKILL.md` for one-shot dialogs, result/cancel contracts, timeouts, and parsing guidance.

They are drafts only; not yet installed or packaged.

## Summary of Changes

Drafted two repo-local Pi/agent skills under `skills/`: `glimpse-open` for persistent windows/event loops and `glimpse-prompt` for one-shot dialogs/results. Included usage guidance, shell snippets, event/result contracts, and safety notes.
