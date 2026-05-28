# Context Glossary

## Glimpse

The underlying micro-UI/window runtime that creates native UI windows.

## glimpse-cli

A command-line wrapper around the Glimpse runtime. It lets shell scripts and agents open native UI windows, receive user input, and update existing windows over time without embedding UI runtime code directly in each script.

## Window

A native UI instance created through Glimpse. Opening a persistent Window completes only after the native Window exists and the page bridge is ready. Bridge readiness is also represented as a `window.ready` system Window Event.

## Window ID

A stable opaque handle returned when a persistent Window is opened. Later commands use the Window ID to address that Window.

## Window Name

An optional human-friendly alias for an open Window. Window Names must be unique among currently open Windows so they can address Windows unambiguously. Window Names are case-sensitive script-safe identifiers and must not use reserved Window ID prefixes. A closed Window's former name can be reused immediately; close-event tombstones remain addressable only by Window ID.

## Window Replacement

Opening a Window with a name that is already in use is rejected unless replacement is explicitly requested. Replacement closes the existing Window, discards its event queue, stops any watcher attached to it, and creates a fresh Window with a new Window ID. Replacement reserves the Window Name for the duration of the operation so another command cannot claim it during the close/open gap. If replacement fails after closing the old Window, the Window Name is released and the failure reports that the old Window was closed.

## Window Closure

An explicit request to close a Window. Closing a missing or stale Window fails by default instead of being treated as an idempotent success. All open Windows can be closed through an explicit close-all operation. Normal closure uses standard close semantics and emits Close Events. Forced closure discards event queues and tombstones, stops watchers, and lets the Ephemeral Daemon exit immediately when no Windows remain.

## Window Reference

A value passed through `-w` or `--window` that addresses a Window. A Window Reference may be either a Window ID or a Window Name.

## CLI Contract

The platform-neutral command and data model exposed by glimpse-cli. The contract should avoid platform-specific terminology unless a capability is explicitly tied to a platform. The CLI should remain close to the Glimpse JavaScript SDK and expose SDK window options through CLI flags rather than defining a smaller independent option set. JavaScript SDK option names map to kebab-case CLI flags. SDK options can also be supplied as a JSON object using JavaScript SDK camelCase keys; explicit CLI flags, including nested option flags, override JSON-supplied options. Options files are file-based only in v1 and do not read from standard input.

## Supported Platform

An operating system where glimpse-cli has a working implementation. macOS is the first Supported Platform, but the CLI Contract is intended to remain cross-platform.

## Ephemeral Daemon

A background process that owns persistent Windows. It starts on demand when the first persistent Window is opened and exits automatically after the last Window is closed. Its lifecycle is normally invisible to users and is not managed through primary v1 commands. After the last Window closes, it may remain alive for a short grace period to serve final close events. On macOS, CLI commands communicate with the Ephemeral Daemon through local same-user IPC using a Unix domain socket. Daemon discovery uses a predictable per-user socket path plus state or lock files for safe startup coordination. The daemon accepts concurrent CLI connections while serializing mutations and event-queue consumption per Window.

## Stale Window ID

A Window ID that no longer addresses a reachable Window, usually because the Window was closed or the Ephemeral Daemon exited. Commands targeting a Stale Window ID fail instead of recreating state implicitly, except for short-lived access to a closed Window's final events.

## Prompt

A one-shot foreground interaction that opens a temporary Window, waits for user input or closure, prints the result, and exits. A Prompt is separate from daemon-owned persistent Windows by default. User cancellation or Window closure is a successful Prompt result with a null value, not a technical error. A Prompt can have an explicit timeout; timeout is a technical failure rather than a cancellation result. A Prompt resolves and closes after the first page-to-CLI message, returning the raw submitted value as its result. URL-based Prompts require the page bridge; remote URL Prompts require both remote loading and bridge allowance.

## Window Event

A JSON-serializable message sent from a persistent Window to glimpse-cli. Window Events are queued in memory so shell scripts and agents can read or wait for them through later CLI commands. Waiting for a Window Event consumes one matching event by default; peeking/events inspection does not consume events. Peeking returns currently queued unconsumed events only. Unfiltered reads and waits return the oldest queued event, including system events. Filtered reads and waits consume only the first matching event and preserve non-matching queued events. Waiting blocks indefinitely unless a timeout is provided. A non-blocking read with no matching queued event is a successful null result. Event queues are bounded; overflow drops the oldest droppable event and reports a `glimpse.error` event. The default event queue size is 1000 events per Window and can be increased up to 20000 events. Event queues live only while their Window and Ephemeral Daemon live, except for a short-lived final close event after Window closure. In v1, event commands address one Window at a time through a Window Reference. Window Events can be filtered by top-level event type. Untyped page payloads are wrapped as `json` events. System event prefixes are reserved and cannot be used by page-defined events; violations are reported as `glimpse.error` events. Page-defined readiness is represented by ordinary page-defined Window Events.

## Close Event

A system Window Event emitted when a persistent Window closes. The Close Event remains readable for up to 30 seconds after closure so scripts can observe normal user closure before the Window Reference becomes fully stale.

## Page Message

A JSON-serializable message sent from glimpse-cli to a persistent Window. Page Messages are the default way for scripts and agents to update or command a Window. In v1, Page Messages are delivered through a page-side listener API rather than a built-in request-response protocol. Successful delivery means the message was delivered to the webview bridge, not that application code handled it. Page Messages sent by the CLI require an explicit type. Page Message data supplied through `--data` is JSON-only; `--text` is the convenience form for string data. Larger JSON data can be supplied through a data file or standard input.

## Eval

Explicit execution of raw JavaScript inside a Window. Eval is separate from Page Messages because it is more powerful and less structured. Eval returns the evaluated result when it is JSON-serializable. Eval is enabled by default for local CLI use because the command name makes the risk explicit. Remote bridged Windows allow Eval only after explicit remote loading and bridge allowance.

## Command Result

The JSON value printed by a glimpse-cli command. Commands default to JSON output so scripts and agents can parse results reliably. Command Results use a consistent envelope with `ok: true` for success and `ok: false` with an error object for failure.

## Core Command

A first-class v1 glimpse-cli operation. The v1 Core Commands are `prompt`, `open`, `set-html`, `navigate`, `send`, `eval`, `wait`, `read`, `events`, `peek`, `close`, and `list`. v1 does not include a general command for mutating Window options after opening.

## Window Listing

A diagnostic view of currently open Windows. Listing succeeds even when the Ephemeral Daemon is not running, returning an empty Window list and daemon state instead of an error. Listing shows open Windows by default and can explicitly include recently closed Windows with `--include-closed`. Window Listing entries include Window state and event queue size; closed entries include their expiry time.

## HTML Source

The HTML content used to create or replace a Window. The canonical HTML Source forms are a positional file path, `-` for standard input, and `--html` for an inline literal string. HTML Sources are read once by default unless watch mode is explicitly enabled. Commands that create or replace Window HTML use this same source model. Replacing Window HTML does not change Window options. Local and inline HTML Sources receive a default Content Security Policy that blocks remote subresources unless explicitly relaxed. Remote subresources can be allowed through `--allow-remote-resources`, or the policy can be replaced through an explicit CSP option. The default CSP allows loopback, literal localhost, and broad `.localhost` resources for local development workflows. CSP is part of Window creation policy and persists across HTML replacement and watch reloads. Manual HTML replacement and watched HTML reloads emit `html.reloaded` system events after the new HTML is loaded and the page bridge is ready.

## URL Source

A URL loaded directly into a Window through an explicit URL option. URL Sources are supported in v1 alongside HTML Sources. URL Sources require an explicit URL option rather than positional input. Existing Windows change to URL Sources through navigation rather than HTML replacement. URL Source policy applies during navigation rather than HTML Source CSP. For URL Sources, trusted local URLs are allowed by default with the page bridge enabled. Remote URLs require explicit `--allow-remote` before they can be loaded and load without the page bridge unless `--allow-bridge` is also explicit. Trusted local URLs include loopback, file URLs, and `.localhost` hostnames only when they resolve to loopback addresses. URL trust is checked once before loading or navigation in v1. Redirects or navigations from trusted URL Sources to untrusted URLs are blocked unless remote loading is explicitly allowed. Link clicks that navigate inside the Window follow the same URL trust policy; links opened externally are handled outside the Window. Successful navigation emits `window.navigated`; blocked navigation emits `glimpse.error`. Navigation commands return only after navigation completes enough for safe follow-up commands. Remote URL Sources can be read-only when the page bridge is not injected. Bridge-dependent commands fail clearly when used against Windows without a page bridge.

## Watch Mode

An explicit mode where glimpse-cli observes a file-based HTML Source and updates the associated Window when the source changes. The Ephemeral Daemon owns watch mode, and each watcher lives only as long as its Window. Watch Mode fully reloads the Window HTML on change unless a future hot-reload capability is explicitly introduced.
