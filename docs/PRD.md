# glimpse-cli PRD

## Purpose

`glimpse-cli` is a command-line wrapper around the Glimpse micro-UI runtime. It lets scripts and agents open native UI windows, collect user input, and update existing windows over time without embedding Glimpse runtime code directly in every script.

macOS is the first supported implementation target, but the command and data model should remain platform-neutral.

## Implementation Stack

v1 should use a minimal dependency policy while avoiding custom implementations for well-solved infrastructure.

- Runtime/tooling: Bun with TypeScript.
- Package identity: publish as `glimpse-cli` with binary name `glimpse`.
- Binary goal: keep the code compatible with `bun build --compile` so `glimpse` can become a standalone binary.
- CLI parser: `commander`.
- JSON validation: `valibot` for command inputs, IPC payloads, command results, and persisted daemon state.
- Logging: `evlog` for structured daemon/CLI diagnostics.
- UI runtime: `glimpseui` from npm. Direct Glimpse imports should be isolated behind an internal adapter module so runtime package/API changes do not leak into command logic.
- File watching: start with built-in file watching for single-file HTML watch mode. If reliability issues appear or directory watching is needed, prefer `@parcel/watcher` over `chokidar`. Avoid `chokidar` by default due to prior memory-leak concerns and because v1 does not need glob-heavy watcher features. Before adopting `@parcel/watcher`, verify compatibility with `bun build --compile` because it uses native components.
- IPC: built-in Unix domain sockets via `node:net` on macOS, using newline-delimited JSON for request/response framing. IPC methods mirror CLI command names to keep command parsing and daemon dispatch simple.
- IDs: built-in `node:crypto` UUIDs.
- URL/DNS checks: built-in `node:url`, `node:dns/promises`, and `node:net`.
- Duration parsing: small local helper for `ms`, `s`, and `m` suffixes.

Avoid additional dependencies in v1 unless they remove substantial complexity or address a proven reliability issue.

Recommended source layout:

```text
src/
  cli.ts
  daemon-main.ts
  daemon/
    daemon.ts
    window-registry.ts
    event-queue.ts
  commands/
    open.ts
    prompt.ts
  ipc/
    client.ts
    server.ts
    protocol.ts
  platform/
    paths.ts
    url-policy.ts
  runtime/
    glimpse-adapter.ts
  schemas/
    command-results.ts
    ipc.ts
  utils/
    duration.ts
    json.ts
```

The layout may be collapsed during early implementation if a separate file would add ceremony without clarity.

Testing uses Bun's built-in test runner (`bun test`). Prioritize unit tests for duration parsing, JSON/Valibot schemas, URL trust policy, CSP generation, event queue semantics, IPC protocol framing, daemon startup path/lock behavior, and command parser smoke tests. Native window tests can start as manual or minimal smoke tests.

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
- daemon discovery uses predictable per-user socket path plus state files under `$TMPDIR/glimpse-cli-$UID/` (`daemon.sock`, `daemon.json`) and an atomic startup lock directory named `daemon.lock`
- daemon startup uses detached child process launch followed by socket `ping` polling until ready or a 5 second startup timeout
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

Exit codes:

- `0`: success
- `1`: runtime or command failure with JSON error
- `2`: usage or validation error

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

Trusted URL algorithm:

1. Parse URL.
2. If protocol is `file:`, trusted.
3. If protocol is not `http:` or `https:`, untrusted.
4. If hostname is `localhost`, trusted.
5. If hostname is loopback IP (`127.0.0.0/8` or `::1`), trusted.
6. If hostname ends with `.localhost`, resolve DNS once.
7. `.localhost` is trusted only if every resolved address is loopback.
8. Everything else is remote/untrusted.

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

Initial v1 default CSP:

```text
default-src 'self' data: blob:;
img-src 'self' data: blob: http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:* http://*.localhost:* https://*.localhost:*;
style-src 'self' 'unsafe-inline' data:;
script-src 'self' 'unsafe-inline' blob:;
connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* http://127.0.0.1:* https://127.0.0.1:* ws://127.0.0.1:* wss://127.0.0.1:* http://*.localhost:* https://*.localhost:* ws://*.localhost:* wss://*.localhost:*;
font-src 'self' data:;
media-src 'self' data: blob:;
```

The implementation may adjust this exact string if WKWebView behavior requires changes while preserving the stated policy intent.

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
