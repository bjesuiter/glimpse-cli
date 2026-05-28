---
name: glimpse-prompt
description: One-shot Glimpse dialog. Use for confirm, choice, small form, text input, approval. Opens, returns JSON result, closes.
---

# Glimpse Prompt Mode

`glimpse prompt` = one-shot interaction. Opens temp window, waits for first page -> CLI message or close, prints JSON, exits.

## Use when

- Need exactly one answer from user.
- UI should close after submit/cancel.
- Script should block until result exists.
- No need update same window later.

Long-lived dashboard / multi-step event loop? Use `glimpse-open` skill.

## Minimal prompt

```bash
result_json=$(glimpse prompt --width 360 --height 220 --title "Confirm" --html '
  <main>
    <p>Continue?</p>
    <button id="yes">Yes</button>
    <button id="cancel">Cancel</button>
  </main>
  <script>
    document.querySelector("#yes").addEventListener("click", () => {
      window.glimpse?.send?.({ type: "confirm.accepted" });
    });
    document.querySelector("#cancel").addEventListener("click", () => {
      window.glimpse?.send?.({ type: "prompt.canceled" });
    });
  </script>
')

echo "$result_json"
```

Success envelope, submitted value in `result`:

```json
{"ok":true,"result":{"type":"confirm.accepted"}}
```

User closes window without submit:

```json
{"ok":true,"result":{"type":"window.closed"}}
```

## Cancel contract

Explicit cancel button sends reserved payload:

```js
window.glimpse?.send?.({ type: 'prompt.canceled' });
```

Do not send raw `null`. v1 treats raw `null` like window close. Prefer discriminated payloads: every terminal outcome has `type`.

## Small form pattern

```bash
glimpse prompt --title "Label item" --width 420 --height 260 --html '
  <form id="form">
    <label>Name <input id="name" autofocus /></label>
    <button>Save</button>
    <button type="button" id="cancel">Cancel</button>
  </form>
  <script>
    document.querySelector("#form").addEventListener("submit", event => {
      event.preventDefault();
      window.glimpse?.send?.({
        type: "item.labeled",
        name: document.querySelector("#name").value
      });
    });
    document.querySelector("#cancel").addEventListener("click", () => {
      window.glimpse?.send?.({ type: "prompt.canceled" });
    });
  </script>
'
```

## Timeout

Use timeout when script must not block forever:

```bash
glimpse prompt --timeout 30s --html '<button onclick="window.glimpse?.send?.({type:`ok`})">OK</button>'
```

Timeout = technical failure (`ok:false`), not prompt result.

## URL + security

Local/trusted URL prompt:

```bash
glimpse prompt --url http://localhost:3000/dialog
```

Remote URL needs `--allow-remote`. Remote page needs send result to CLI? add `--allow-bridge` only then.

## Agent parse rules

- Check `ok` first.
- Branch on `result.type`.
- Treat `prompt.canceled` + `window.closed` as successful terminal user outcomes, not command failures.
- Use `--html` for short inline prompts, file path for bigger UI, `-` for HTML from stdin.
