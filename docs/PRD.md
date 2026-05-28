# glimpse-cli PRD

## Purpose

`glimpse-cli` is a command-line wrapper around the Glimpse micro-UI runtime. It lets scripts and agents open native UI windows, collect user input, and update existing windows over time without embedding Glimpse runtime code directly in every script.

macOS is the first supported implementation target, but the command and data model should remain platform-neutral.

## v1 Commands

- `glimpse prompt <html-source>`: one-shot foreground interaction.
- `glimpse open <html-source>`: open persistent daemon-owned Window.
- `glimpse open --url <url>`: open URL Source.
- `glimpse set-html -w <ref> <html-source>`: replace Window HTML.
- `glimpse navigate -w <ref> --url <url>`: navigate Window to URL Source.
- `glimpse send -w <ref> --type <type> (--data <json>|--data-file <path|->|--text <text>)`: send structured Page Message.
- `glimpse eval -w <ref> <js>`: execute raw JavaScript and return JSON-serializable result.
- `glimpse wait -w <ref> [--type <type>] [--timeout <duration>]`: block until one matching event and consume it.
- `glimpse read -w <ref> [--type <type>]`: non-blocking event consume.
- `glimpse events -w <ref>` / `glimpse peek -w <ref>`: inspect queued unconsumed events without consuming.
- `glimpse close -w <ref> [--force]`: close one Window.
- `glimpse close --all [--force]`: close all Windows.
- `glimpse list [--include-closed]`: list open Windows, optionally recent closed tombstones.

No general v1 command mutates Window options after opening.

## HTML and URL Sources

HTML Sources:

- positional file path
- `-` for stdin
- `--html <literal>`

HTML is read once by default. `--watch` makes the daemon watch file-based HTML and fully reload Window HTML on changes. Watchers are daemon-owned and live only as long as their Window.

URL Sources require explicit `--url`; positional URLs are not supported in v1.

Existing Windows move to URL Sources via `navigate`, not `set-html`.

## Persistent Windows and Daemon

Persistent Windows are owned by an Ephemeral Daemon:

- starts on first persistent `open`
- exits after last Window closes
- may remain alive for up to 30 seconds to serve final close events
- macOS IPC uses local same-user Unix domain socket
- daemon discovery uses predictable per-user socket path plus state/lock files
- concurrent CLI connections are allowed
- mutations and event queue consumption are serialized per Window

`prompt` is standalone foreground by default and does not require the daemon.

## Window References

Every persistent Window gets an opaque `windowId`.

Users may optionally assign a unique active Window Name:

```fish
glimpse open ./status.html --name build
```

Commands address Windows with only:

```fish
-w, --window <ref>
```

`<ref>` may be a Window ID or Window Name.

Window Names are case-sensitive, script-safe identifiers and must not use reserved Window ID prefixes. Closed Window names can be reused immediately; close-event tombstones remain addressable only by old Window ID.

`open --name <name>` fails if the name is in use unless `--replace` is passed. Replacement closes the existing Window, discards its event queue, stops watchers, creates a fresh Window with a new ID, and reserves the name during the operation.

## Command Results

Commands default to JSON output.

Success:

```json
{ "ok": true }
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "window_not_found",
    "message": "Window build is not open."
  }
}
```

Prompt cancellation/window close is not an error:

```json
{ "ok": true, "result": null }
```

Timeouts are technical failures.

## Prompt Semantics

`prompt` opens a temporary Window, waits for first page-to-CLI message, prints raw submitted value as `result`, closes, and exits.

`prompt --timeout <duration>` fails with `timeout` if no result arrives.

Remote URL prompts require both `--allow-remote` and `--allow-bridge` because prompts need the page bridge.

## Window Events

Persistent Window page-to-CLI messages become queued Window Events.

Event commands in v1 require `-w`.

Event behavior:

- `wait` consumes one matching event.
- `read` consumes one matching event if present.
- `events`/`peek` inspect currently queued unconsumed events only.
- unfiltered `wait`/`read` return oldest queued event, including system events.
- filtered `wait`/`read` consume only first matching event and preserve non-matching events.
- `read` with no matching event returns `{ "ok": true, "event": null }`.
- `wait` blocks indefinitely unless `--timeout` is provided.

Queue size:

- default 1000 events per Window
- configurable up to 20000 events
- overflow drops oldest droppable event and reports `glimpse.error`

Untyped page payloads are wrapped as event type `json`.

System prefixes are reserved; page attempts to use them produce `glimpse.error`.

System events include:

- `window.ready`
- `window.closed`
- `window.navigated`
- `html.reloaded`
- `glimpse.error`

`window.closed` remains readable for up to 30 seconds after closure.

## Page Messages and Eval

`send` sends structured JSON Page Messages to a Window bridge.

Rules:

- explicit `--type` required
- `--data` is JSON-only
- `--text` sends string data
- `--data-file <path|->` supports large/generated JSON
- success means delivered to the webview bridge, not handled by app code
- v1 has listener-style delivery only, no built-in request/response protocol

`eval` executes raw JS. It is enabled by default for local CLI use because the command name is explicit. It returns JSON-serializable result values.

Bridge-dependent commands fail clearly against Windows without bridge.

## Window Options

CLI stays close to the Glimpse JavaScript SDK.

- JS SDK option names map to kebab-case CLI flags.
- SDK options can also be supplied as JSON object using SDK camelCase keys.
- explicit CLI flags override JSON options, including nested option flags.
- options files are file-based only in v1; they do not read from stdin.

Example:

```fish
glimpse open ./ui.html \
  --click-through \
  --follow-cursor \
  --follow-mode spring \
  --cursor-offset 20,-20 \
  --options-json '{"width":400,"height":300}'
```

## URL Security Policy

Trusted local URL Sources are allowed by default with bridge enabled.

Trusted local URLs:

- loopback hosts
- `file:` URLs
- `.localhost` hostnames only when they resolve to loopback addresses

Trust is checked before loading/navigation. Redirects or in-window navigations to untrusted URLs are blocked unless remote loading is explicitly allowed.

Remote URLs:

- blocked by default
- `--allow-remote` permits loading remote content in read-only/no-bridge mode
- `--allow-bridge` additionally permits bridge injection
- `--allow-bridge` alone does not permit remote loading

Remote bridged Windows allow `send` and `eval` only after explicit remote loading and bridge allowance.

Links opened externally are handled outside the Window.

## HTML CSP Policy

Local and inline HTML Sources receive a default Content Security Policy that blocks remote subresources unless relaxed.

Default CSP intent:

- allow local/inline micro-UI needs
- allow loopback resources
- allow literal `localhost`
- allow broad `.localhost` resources for portless/local-dev workflows
- block arbitrary remote subresources

Escape hatches:

- `--allow-remote-resources`
- explicit `--csp <policy>`

No `--no-csp` in v1.

CSP is part of Window creation policy and persists across `set-html` and watch reloads.

`navigate` uses URL Source policy, not HTML Source CSP.

## Listing

`list` succeeds even when daemon is not running:

```json
{
  "ok": true,
  "daemon": { "running": false },
  "windows": []
}
```

Open Window entries should include state, event queue size, source metadata, and bridge/security metadata.

`--include-closed` includes recently closed entries with expiry time.

## Closure

`close -w <ref>` fails on missing/stale Window by default.

Normal closure emits `window.closed` and keeps tombstone for up to 30 seconds.

Forced closure discards event queues and tombstones, stops watchers, and lets daemon exit immediately when no Windows remain.

`close --all` supports normal and forced closure.

## Deferred Ideas

Tracked as beans:

- `glimpse-cli-pj3z`: Evaluate seamless HMR for watched Glimpse windows.
- `glimpse-cli-zbfv`: Evaluate global event awaiting across windows.
