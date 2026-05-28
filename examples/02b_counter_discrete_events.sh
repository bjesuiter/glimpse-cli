#!/usr/bin/env bash
set -euo pipefail

# Self-contained glimpse-cli example: an interactive counter window.
# Uses one discrete event per button click instead of repeated state snapshots.
# Run from the repo root with: ./examples/02b_counter_discrete_events.sh

GLIMPSE="${GLIMPSE:-bun src/cli.ts}"
WINDOW_NAME="glimpse-counter-example"

HTML=$(cat <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Glimpse Counter</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; overflow-x: hidden; background: radial-gradient(circle at top, #334155, #020617 65%); color: #f8fafc; }
    main { width: min(360px, calc(100vw - 32px)); padding: 28px; border: 1px solid rgba(148, 163, 184, .35); border-radius: 24px; background: rgba(15, 23, 42, .78); box-shadow: 0 24px 80px rgba(0, 0, 0, .45); text-align: center; }
    h1 { margin: 0 0 12px; font-size: 18px; font-weight: 650; color: #cbd5e1; }
    output { display: block; margin: 18px 0 24px; font-size: 72px; font-weight: 800; line-height: 1; letter-spacing: -0.06em; }
    .buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    button { border: 0; border-radius: 14px; padding: 14px 12px; color: #f8fafc; background: #2563eb; font-size: 18px; font-weight: 750; cursor: pointer; }
    button:hover { filter: brightness(1.12); }
    button.secondary { background: rgba(100, 116, 139, .55); }
    p { margin: 18px 0 0; color: #94a3b8; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Interactive Glimpse Counter</h1>
    <output id="count">0</output>
    <div class="buttons">
      <button id="dec" class="secondary">−</button>
      <button id="reset" class="secondary">0</button>
      <button id="inc">+</button>
    </div>
    <p>Each click is sent back as one discrete CLI event.</p>
  </main>
  <script>
    let count = 0;
    const output = document.querySelector('#count');
    function render() { output.textContent = String(count); }
    let seq = 0;
    function emit(action) {
      seq += 1;
      window.glimpse?.send?.({ type: 'counter.changed', action, count, seq });
    }
    document.querySelector('#inc').addEventListener('click', () => { count += 1; render(); emit('increment'); });
    document.querySelector('#dec').addEventListener('click', () => { count -= 1; render(); emit('decrement'); });
    document.querySelector('#reset').addEventListener('click', () => { count = 0; render(); emit('reset'); });
    render();
  </script>
</body>
</html>
HTML
)

open_json=$($GLIMPSE open --name "$WINDOW_NAME" --replace --width 380 --height 430 --title "Glimpse Counter" --html "$HTML")
echo "$open_json"
WINDOW_REF=$(printf '%s' "$open_json" | sed -n 's/.*"windowId":"\([^"]*\)".*/\1/p')
if [[ -z "$WINDOW_REF" ]]; then
  echo "Failed to open counter window." >&2
  exit 1
fi

echo "Opened window '$WINDOW_NAME' ($WINDOW_REF)."
echo "Waiting for discrete counter events. Press Ctrl-C to stop listening; close the window when done."

# Block until the next event instead of polling with repeated CLI invocations.
# Waiting without --type lets the same loop handle both button clicks and the
# window.closed system event.
while true; do
  event_json=$($GLIMPSE wait -w "$WINDOW_REF")

  if [[ "$event_json" == *'"type":"window.closed"'* ]]; then
    echo "$event_json"
    echo "Window closed; stopping listener."
    break
  fi

  if [[ "$event_json" == *'"type":"counter.changed"'* ]]; then
    echo "$event_json"
  fi
done
