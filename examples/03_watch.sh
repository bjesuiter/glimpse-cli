#!/usr/bin/env bash
set -euo pipefail

# Self-contained glimpse-cli example: file-backed watch mode.
# Run from the repo root with: ./examples/03_watch.sh

GLIMPSE="${GLIMPSE:-bun src/cli.ts}"
WINDOW_NAME="glimpse-watch-example"
WATCH_FILE="${WATCH_FILE:-}"
if [[ -n "$WATCH_FILE" ]]; then
  WORK_DIR=""
  HTML_FILE="$WATCH_FILE"
  mkdir -p "$(dirname "$HTML_FILE")"
else
  WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/glimpse-watch-example.XXXXXX")"
  HTML_FILE="$WORK_DIR/watch.html"
fi

cleanup() {
  $GLIMPSE close -w "$WINDOW_NAME" --force >/dev/null 2>&1 || true
  if [[ -n "$WORK_DIR" ]]; then
    rm -rf "$WORK_DIR"
  fi
}
trap cleanup EXIT

render_html() {
  local count="$1"
  local color="$2"
  local now
  now="$(date '+%H:%M:%S')"
  cat > "$HTML_FILE" <<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Glimpse Watch Example</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, ${color}, #020617 68%); color: #f8fafc; }
    main { width: min(390px, calc(100vw - 32px)); padding: 28px; border: 1px solid rgba(148, 163, 184, .35); border-radius: 24px; background: rgba(15, 23, 42, .78); box-shadow: 0 24px 80px rgba(0, 0, 0, .45); text-align: center; }
    h1 { margin: 0 0 8px; font-size: 20px; }
    output { display: block; margin: 20px 0; font-size: 72px; font-weight: 850; line-height: 1; letter-spacing: -0.06em; }
    p { margin: 8px 0 0; color: #cbd5e1; line-height: 1.45; }
    code { color: #a5b4fc; }
  </style>
</head>
<body>
  <main>
    <h1>Watch mode reload</h1>
    <p>The shell rewrites this HTML file once per second.</p>
    <output>${count}</output>
    <p>Last write: <code>${now}</code></p>
  </main>
</body>
</html>
HTML
}

colors=("#1d4ed8" "#7c3aed" "#be123c" "#047857" "#b45309")
render_html 0 "${colors[0]}"

$GLIMPSE open "$HTML_FILE" --watch --name "$WINDOW_NAME" --replace --width 440 --height 420 --title "Glimpse Watch"

echo "Opened '$WINDOW_NAME' with --watch."
echo "Updating $HTML_FILE every second. Press Ctrl-C to stop."

count=0
while true; do
  count=$((count + 1))
  color="${colors[$((count % ${#colors[@]}))]}"
  render_html "$count" "$color"
  sleep 1
done
