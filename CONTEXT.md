# Context Glossary

## Glimpse

The underlying micro-UI/window runtime that creates native UI windows.

## glimpse-cli

A command-line wrapper around the Glimpse runtime. It lets shell scripts and agents open native UI windows, receive user input, and update existing windows over time without embedding UI runtime code directly in each script.

## Window

A native UI instance created through Glimpse.

## Window ID

A stable handle returned when a persistent Window is opened. Later commands use the Window ID to address that Window.

## CLI Contract

The platform-neutral command and data model exposed by glimpse-cli. The contract should avoid platform-specific terminology unless a capability is explicitly tied to a platform.

## Supported Platform

An operating system where glimpse-cli has a working implementation. macOS is the first Supported Platform, but the CLI Contract is intended to remain cross-platform.

## Ephemeral Daemon

A background process that owns persistent Windows. It starts on demand when the first persistent Window is opened and exits automatically after the last Window is closed.

## Stale Window ID

A Window ID that no longer addresses a reachable Window, usually because the Window was closed or the Ephemeral Daemon exited. Commands targeting a Stale Window ID fail instead of recreating state implicitly.

## Prompt

A one-shot foreground interaction that opens a temporary Window, waits for user input or closure, prints the result, and exits. A Prompt is separate from daemon-owned persistent Windows by default.

## Window Event

A JSON-serializable message sent from a persistent Window to glimpse-cli. Window Events are queued in memory so shell scripts and agents can read or wait for them through later CLI commands. Waiting for a Window Event consumes one matching event by default; peeking/events inspection does not consume events. Event queues live only while their Window and Ephemeral Daemon live.

## Page Message

A JSON-serializable message sent from glimpse-cli to a persistent Window. Page Messages are the default way for scripts and agents to update or command a Window.

## Eval

Explicit execution of raw JavaScript inside a Window. Eval is separate from Page Messages because it is more powerful and less structured.

## Command Result

The JSON value printed by a glimpse-cli command. Commands default to JSON output so scripts and agents can parse results reliably. Command Results use a consistent envelope with `ok: true` for success and `ok: false` with an error object for failure.

## HTML Source

The HTML content used to create or replace a Window. The canonical HTML Source forms are a positional file path, `-` for standard input, and `--html` for an inline literal string. HTML Sources are read once by default unless watch mode is explicitly enabled.

## Watch Mode

An explicit mode where glimpse-cli observes a file-based HTML Source and updates the associated Window when the source changes. The Ephemeral Daemon owns watch mode, and each watcher lives only as long as its Window.
