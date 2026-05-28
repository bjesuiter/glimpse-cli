---
name: glimpse-open
description: Persistent Glimpse window. Use for long-lived UI, dashboard, inspector, multi-step form, shell event loop, update/send/wait.
---

# Glimpse Open Mode

`glimpse open` = persistent window. Returns `windowId`. Later commands use `-w <windowId-or-name>`.

## Use when

- UI stay open after command returns.
- Agent/script needs many user interactions over time.
- Need update same window: `set-html`, `send`, `navigate`, `eval`.
- Need event loop: `wait`, `read`, `peek`, `events`.

One-shot input? Use `glimpse-prompt` skill.

## Minimal persistent window

```bash
open_json=$(glimpse open --name my-tool --replace --width 420 --height 320 --title "My Tool" --html '<h1>Hello</h1>')
window_id=$(printf '%s' "$open_json" | sed -n 's/.*"windowId":"\([^"]*\)".*/\1/p')
```

Use `--name` = stable human handle. Use `--replace` during dev -> avoid name conflict.

## Page -> agent events

Local/inline HTML gets bridge automatically. Page sends JSON-serializable events:

```html
<button id="save">Save</button>
<script>
  document.querySelector('#save').addEventListener('click', () => {
    window.glimpse?.send?.({ type: 'form.saved', value: 'example' });
  });
</script>
```

Wait unfiltered if loop must also detect close:

```bash
while true; do
  event_json=$(glimpse wait -w "$window_id")

  if [[ "$event_json" == *'"type":"window.closed"'* ]]; then
    break
  fi

  if [[ "$event_json" == *'"type":"form.saved"'* ]]; then
    echo "$event_json"
  fi
done
```

`wait` consumes one queued event. `read` = non-blocking consume. `peek`/`events` = inspect queued events, no consume.

## Agent -> page messages

Send structured messages:

```bash
glimpse send -w "$window_id" --type app.update --data '{"status":"Working"}'
glimpse send -w "$window_id" --type app.log --text "Finished step 1"
```

Page handles via bridge listener API if available. No listener? Use explicit local `eval`.

## Update / navigate / close

```bash
glimpse set-html -w "$window_id" --html '<h1>Updated</h1>'
glimpse navigate -w "$window_id" --url http://localhost:3000
glimpse eval -w "$window_id" 'document.body.dataset.ready = "true"'
glimpse close -w "$window_id"
```

Remote URL: add `--allow-remote`. Remote page needs CLI bridge? add `--allow-bridge` only then.

## Event design

- Prefer discrete user-action events: `{ type: 'counter.changed', action, count }`.
- Use repeated state snapshots only for slow/lossy consumers + latest-state reconciliation.
- Always include top-level `type` string.
- App events must not use reserved system prefixes: `window.*`, `html.*`, `glimpse.*`.
