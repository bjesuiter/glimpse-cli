# Glimpse CLI

Show native UI windows from scripts and agents. Glimpse lets shell scripts open small HTML-based windows, prompt the user, update persistent UI, and exchange JSON events without sending users to a browser.

## Installation

```sh
npm install -g glimpse-cli
```

Or run from this repository:

```sh
bun install
bun run build
bun src/cli.ts --help
```

## Usage

Glimpse commands print JSON envelopes so scripts and agents can consume results reliably.

### One-shot prompts

Use `prompt` when the window should return one result and close:

```sh
glimpse prompt --title "Confirm" --html '<button onclick="window.glimpse?.send?.({type:&quot;ok&quot;})">OK</button>'
```

Page scripts send data back with:

```js
window.glimpse?.send?.({ type: 'form.submitted', value: 'hello' })
```

### Persistent windows

Use `open` for windows that stay alive and can be updated, polled, or messaged later:

```sh
glimpse open --name demo --replace --width 420 --height 300 --html '<h1>Hello</h1>'
glimpse set-html -w demo --html '<h1>Updated</h1>'
glimpse wait -w demo --timeout 30s
glimpse close -w demo
```

Window refs can be either a stable `--name` or the returned `windowId`.

### HTML sources

Most HTML commands accept:

- an inline snippet via `--html`
- a file path argument
- stdin via `-`
- URLs via `--url`

Examples:

```sh
glimpse open ./panel.html --watch --name panel
glimpse open --url http://localhost:3000 --width 1000 --height 700
cat panel.html | glimpse prompt -
```

### Events

Use `wait`, `read`, `peek`, or `events` to consume or inspect page events:

```sh
glimpse wait -w demo
glimpse read -w demo --type counter.changed
glimpse peek -w demo
glimpse events -w demo --include-consumed
```

`wait` and `read` consume events. `peek` and `events` inspect without consuming. App event types must not use reserved prefixes: `window.*`, `html.*`, or `glimpse.*`.

### Security notes

Loopback URLs are trusted by default. Non-loopback remote URLs require `--allow-remote`. Remote pages only receive the Glimpse bridge with `--allow-bridge`. Inline and file-backed HTML use a restrictive default CSP unless you pass `--allow-remote-resources` or `--csp`.

## Examples

The `examples/` directory contains runnable scripts. They assume a global `glimpse` command from `npm install -g glimpse-cli` or a local `bun link`:

```sh
./examples/01_prompt.sh
./examples/02_counter.sh
./examples/02b_counter_w_state.sh
./examples/03_watch.sh
```

### [`examples/01_prompt.sh`](examples/01_prompt.sh) — one-shot prompt

Opens a small form, returns the submitted value as JSON, and exits. This is the simplest pattern for scripts that need one piece of user input.

### [`examples/02_counter.sh`](examples/02_counter.sh) — discrete event stream

Opens a persistent counter window. Each button click sends one `counter.changed` event back to the shell, where the script waits and prints events until the window closes.

### [`examples/02b_counter_w_state.sh`](examples/02b_counter_w_state.sh) — latest-state reconciliation

A variant of the counter that emits click events plus short-lived `counter.snapshot` repeats. Use this pattern when a consumer cares about the latest state more than every individual click.

### [`examples/03_watch.sh`](examples/03_watch.sh) — file-backed watch mode

Writes an HTML file, opens it with `--watch`, then rewrites the file once per second. Glimpse reloads the window as the file changes.

## Development

```sh
bun run typecheck
bun run test
bun run build
```

The npm playground verifies the published package shape:

```sh
npm install --prefix playground/npm
npm test --prefix playground/npm
```

## License

MIT
