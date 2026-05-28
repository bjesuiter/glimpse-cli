#!/usr/bin/env bash
set -euo pipefail

# Self-contained glimpse-cli example: one-shot prompt window.
# Run from the repo root with: ./examples/01_prompt.sh

GLIMPSE="${GLIMPSE:-bun src/cli.ts}"

HTML=$(cat <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Glimpse Prompt</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: linear-gradient(135deg, #111827, #312e81); color: #f8fafc; }
    form { width: min(420px, calc(100vw - 32px)); padding: 28px; border: 1px solid rgba(199, 210, 254, .35); border-radius: 24px; background: rgba(15, 23, 42, .82); box-shadow: 0 24px 80px rgba(0, 0, 0, .45); }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0 0 18px; color: #cbd5e1; line-height: 1.45; }
    label { display: block; margin-bottom: 8px; color: #c4b5fd; font-size: 13px; font-weight: 700; }
    input { box-sizing: border-box; width: 100%; border: 1px solid rgba(199, 210, 254, .35); border-radius: 14px; padding: 13px 14px; color: #f8fafc; background: rgba(2, 6, 23, .65); font: inherit; outline: none; }
    input:focus { border-color: #818cf8; box-shadow: 0 0 0 4px rgba(129, 140, 248, .18); }
    .actions { display: flex; gap: 10px; margin-top: 16px; }
    button { flex: 1; border: 0; border-radius: 14px; padding: 13px 14px; color: #f8fafc; background: #4f46e5; font-weight: 800; cursor: pointer; }
    button.secondary { background: rgba(100, 116, 139, .55); }
    button:hover { filter: brightness(1.12); }
    small { display: block; margin-top: 14px; color: #94a3b8; }
  </style>
</head>
<body>
  <form id="prompt-form">
    <h1>Quick prompt</h1>
    <p>Submit a short value back to the shell. Cancel and window close return explicit result objects.</p>
    <label for="answer">What should Glimpse say?</label>
    <input id="answer" name="answer" value="Hello from Glimpse" autofocus />
    <div class="actions">
      <button type="button" class="secondary" id="cancel">Cancel</button>
      <button type="submit">Submit</button>
    </div>
    <small>Try editing the text, then press Enter.</small>
  </form>
  <script>
    const form = document.querySelector('#prompt-form');
    const answer = document.querySelector('#answer');
    form.addEventListener('submit', event => {
      event.preventDefault();
      window.glimpse?.send?.({ answer: answer.value, submittedAt: new Date().toISOString() });
    });
    document.querySelector('#cancel').addEventListener('click', () => window.glimpse?.send?.({ type: 'prompt.canceled' }));
    answer.select();
  </script>
</body>
</html>
HTML
)

echo "Opening prompt window..."
$GLIMPSE prompt --width 540 --height 390 --title "Glimpse Prompt" --html "$HTML"
