#!/usr/bin/env node
import { Command } from "commander";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "./ipc/client.ts";
import { parseDuration } from "./utils/duration.ts";
import { parseJson, readDataFile, readStdin } from "./utils/json.ts";
import { assertUrlAllowed } from "./platform/url-policy.ts";
import { promptWindow, withBridge } from "./runtime/glimpse-adapter.ts";
import { iframeForUrl } from "./cli-helpers.ts";

const DEFAULT_CSP =
  "default-src 'self' data: blob:; img-src 'self' data: blob: http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:* http://*.localhost:* https://*.localhost:*; style-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-inline' blob:; connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* http://127.0.0.1:* https://127.0.0.1:* ws://127.0.0.1:* wss://127.0.0.1:* http://*.localhost:* https://*.localhost:* ws://*.localhost:* wss://*.localhost:*; font-src 'self' data:; media-src 'self' data: blob:;";

function print(v: unknown) {
  console.log(JSON.stringify(v));
}
function ok(result?: unknown) {
  print(result === undefined ? { ok: true } : { ok: true, ...(result as any) });
}
async function run(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    print({
      ok: false,
      error: { code: (err as any).code ?? "command_failed", message: (err as Error).message },
    });
    process.exitCode = /usage|Invalid/.test((err as Error).message) ? 2 : 1;
  }
}
async function htmlSource(src: string | undefined, opts: any) {
  if (opts.html != null) return String(opts.html);
  if (src === "-") return readStdin();
  if (!src) throw new Error("usage: missing html-source");
  return readFileSync(src, "utf8");
}
function options(o: any) {
  const base = o.optionsJson ? (parseJson(o.optionsJson, "options JSON") as any) : {};
  for (const k of [
    "width",
    "height",
    "title",
    "x",
    "y",
    "frameless",
    "floating",
    "transparent",
    "clickThrough",
    "followCursor",
    "followMode",
  ])
    if (o[k] != null) base[k] = o[k];
  if (o.cursorOffset) {
    const [x, y] = String(o.cursorOffset).split(",").map(Number);
    base.cursorOffset = { x, y };
  }
  return base;
}
function addWindow(c: Command) {
  return c.requiredOption(
    "-w, --window <ref>",
    "Window id or window name returned by/opened with `glimpse open`.",
  );
}
function addUrlPolicy(c: Command) {
  return c.option(
    "--allow-remote",
    "Allow non-loopback remote URLs. Loopback URLs are allowed by default.",
  );
}
function addHtmlPolicy(c: Command) {
  return c
    .option(
      "--allow-remote-resources",
      "Do not apply the default restrictive CSP to inline/file HTML.",
    )
    .option("--csp <policy>", "Custom Content-Security-Policy for inline/file HTML.");
}
function addOpenPolicy(c: Command) {
  return addHtmlPolicy(
    addUrlPolicy(c).option(
      "--allow-bridge",
      "Inject the Glimpse page bridge into remote URL content.",
    ),
  );
}
function addPromptPolicy(c: Command) {
  return addHtmlPolicy(
    addUrlPolicy(c).option(
      "--allow-bridge",
      "Required for remote URL prompts so the page can return a result.",
    ),
  );
}
function addHtml(c: Command) {
  return addHtmlPolicy(
    c
      .argument("[html-source]", "HTML file path, `-` for stdin, or omit when using --html.")
      .option("--html <literal>", "Inline HTML literal."),
  );
}
function addOpts(c: Command) {
  return c
    .option("--name <name>", "Stable window name/handle.")
    .option("--replace", "Replace an existing window with the same name.")
    .option("--options-json <json>", "Raw Glimpse window options JSON.")
    .option("--width <n>", "Window width in CSS pixels.", Number)
    .option("--height <n>", "Window height in CSS pixels.", Number)
    .option("--title <title>", "Window title.")
    .option("--x <n>", "Initial window x position.", Number)
    .option("--y <n>", "Initial window y position.", Number)
    .option("--frameless", "Open without native window frame.")
    .option("--floating", "Keep window above normal windows.")
    .option("--transparent", "Enable transparent window background.")
    .option("--click-through", "Let mouse clicks pass through the window.")
    .option("--follow-cursor", "Keep the window near the cursor.")
    .option("--follow-mode <mode>", "Cursor-following mode passed to Glimpse.")
    .option("--cursor-offset <x,y>", "Cursor-following offset, for example `12,20`.");
}

const here = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(here, "..", "package.json"), "utf8")) as {
  version: string;
};
const packageVersion = packageJson.version;
const skillsDir = resolve(here, "..", "skills");
const examplesDir = resolve(here, "..", "examples");
const skillNames = ["glimpse-open", "glimpse-prompt"] as const;
function bundledExamples() {
  if (!existsSync(examplesDir)) return "\nEXAMPLE FILES\n  No bundled examples directory found.\n";
  const files = readdirSync(examplesDir)
    .filter((file) => file.endsWith(".sh"))
    .sort();
  if (files.length === 0) return "\nEXAMPLE FILES\n  No bundled shell examples found.\n";
  return (
    "\nEXAMPLE FILES\n" +
    files
      .map((file) => {
        const path = join(examplesDir, file);
        const source = readFileSync(path, "utf8").trimEnd();
        return `\n  ${file}\n\n${source
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n")}`;
      })
      .join("\n") +
    "\n"
  );
}
const usageText = `GLIMPSE(1)                         User Commands                         GLIMPSE(1)

NAME
  glimpse - show native UI windows from scripts and agents

SYNOPSIS
  glimpse [-v|--version]
  glimpse version
  glimpse prompt [options] [html-source]
  glimpse open [options] [html-source]
  glimpse set-html -w <ref> [options] [html-source]
  glimpse wait|read|peek|events -w <ref> [options]
  glimpse send -w <ref> --type <type> (--data <json>|--data-file <path>|--text <text>)

DESCRIPTION
  Glimpse renders small native windows from HTML. Commands print JSON envelopes
  so shell scripts and agents can parse results reliably.

  Use prompt for one-shot dialogs that return one result and close. Use open for
  persistent windows that can be updated, messaged, and polled for events.

EXAMPLES
  One-shot confirmation:
    glimpse prompt --title "Confirm" --html '<button onclick="window.glimpse?.send?.({type:&quot;ok&quot;})">OK</button>'

  Persistent window:
    glimpse open --name demo --replace --width 420 --height 300 --html '<h1>Hello</h1>'

  Update a persistent window:
    glimpse set-html -w demo --html '<h1>Updated</h1>'

  Wait for the next page event:
    glimpse wait -w demo --timeout 30s

  Send data into a page:
    glimpse send -w demo --type app.update --data '{"status":"done"}'

  Open a local dev server:
    glimpse open --url http://localhost:3000 --width 1000 --height 700

HTML SOURCES
  [html-source] may be a file path or '-' for stdin. Use --html for short inline
  snippets. Inline/file HTML gets the Glimpse bridge automatically.

SECURITY
  Loopback URLs are trusted by default. Non-loopback remote URLs require
  --allow-remote. Remote pages only receive the Glimpse bridge with
  --allow-bridge. Inline/file HTML gets a restrictive default CSP unless you pass
  --allow-remote-resources or --csp.

EVENTS
  Page scripts send events with window.glimpse.send({ type: 'example.done' }).
  wait/read consume events. peek/events inspect without consuming. App event
  types must not use reserved prefixes: window.*, html.*, glimpse.*.

SKILLS
  Bundled agent skills are available with:
    glimpse skills view
    glimpse skills copy ./some/skills/directory

SEE ALSO
  glimpse --help
  glimpse --version
  glimpse version
  glimpse <command> --help
`;

const program = new Command()
  .name("glimpse")
  .description("Show native UI from scripts and agents using HTML.")
  .version(packageVersion, "-v, --version", "Print the glimpse CLI version.")
  .showHelpAfterError()
  .addHelpText(
    "after",
    `
Examples:
  $ glimpse prompt --html '<button onclick="window.glimpse?.send?.({type:&quot;ok&quot;})">OK</button>'
  $ glimpse open --name demo --replace --html '<h1>Hello</h1>'
  $ glimpse usage`,
  )
  .exitOverride();

program
  .command("usage")
  .description("Print man page style usage documentation with longer examples.")
  .action(() => console.log(usageText + bundledExamples()));

program
  .command("version")
  .description("Print the glimpse CLI version.")
  .action(() => console.log(packageVersion));

const skills = program.command("skills").description("View or copy the bundled agent skills.");
skills
  .command("view")
  .description("Print the bundled glimpse-open and glimpse-prompt skill files.")
  .argument("[name]", "Optional skill name: glimpse-open or glimpse-prompt.")
  .action((name?: string) =>
    run(async () => {
      const names = name ? [name] : [...skillNames];
      for (const skill of names) {
        if (!skillNames.includes(skill as any))
          throw new Error(`Invalid skill ${skill}. Expected one of: ${skillNames.join(", ")}`);
        console.log(`--- ${skill}/SKILL.md ---`);
        console.log(readFileSync(join(skillsDir, skill, "SKILL.md"), "utf8").trimEnd());
        console.log();
      }
    }),
  );
skills
  .command("copy")
  .description("Copy bundled skill directories into a target skills directory.")
  .argument("<target-dir>", "Directory that should receive glimpse-open/ and glimpse-prompt/.")
  .option("--force", "Overwrite existing target skill files.")
  .action((targetDir, o) =>
    run(async () => {
      const target = resolve(String(targetDir));
      mkdirSync(target, { recursive: true });
      for (const skill of skillNames)
        cpSync(join(skillsDir, skill), join(target, skill), {
          recursive: true,
          force: Boolean(o.force),
          errorOnExist: !o.force,
        });
      ok({ copied: skillNames, target });
    }),
  );

addOpts(
  addPromptPolicy(
    program
      .command("prompt")
      .description("Open a one-shot dialog, wait for one page result, print JSON, and close.")
      .argument("[html-source]", "HTML file path, `-` for stdin, or omit when using --html/--url.")
      .option("--html <literal>", "Inline HTML literal."),
  ),
)
  .option("--url <url>", "URL to wrap in an iframe for the prompt.")
  .option("--timeout <duration>", "Maximum wait time, for example 500ms, 30s, or 2m.")
  .addHelpText(
    "after",
    `
Examples:
  $ glimpse prompt --title "Confirm" --html '<button onclick="window.glimpse?.send?.({type:&quot;ok&quot;})">OK</button>'
  $ glimpse prompt form.html --timeout 30s`,
  )
  .action((src, o) =>
    run(async () => {
      let html = o.url ? iframeForUrl(o.url) : await htmlSource(src, o);
      if (o.url) {
        const security = await assertUrlAllowed(o.url, o.allowRemote);
        if (!security.trusted && !o.allowBridge)
          throw new Error("Remote URL prompts require --allow-bridge.");
      }
      const res = await promptWindow(
        withBridge(html, o.csp ?? (o.allowRemoteResources ? undefined : DEFAULT_CSP)),
        { ...options(o), timeout: parseDuration(o.timeout) },
      );
      ok({ result: res === null ? { type: "window.closed" } : res });
    }),
  );
addOpts(
  addOpenPolicy(
    program
      .command("open")
      .description("Open a persistent window and print its window id as JSON.")
      .argument("[html-source]", "HTML file path, `-` for stdin, or omit when using --html/--url.")
      .option("--html <literal>", "Inline HTML literal."),
  ),
)
  .option("--url <url>", "URL to load in the window.")
  .option("--watch", "Watch a file html-source and reload the window on changes.")
  .addHelpText(
    "after",
    `
Examples:
  $ glimpse open --name demo --replace --html '<h1>Hello</h1>'
  $ glimpse open ./dashboard.html --watch
  $ glimpse open --url http://localhost:3000`,
  )
  .action((src, o) =>
    run(async () => {
      if (o.watch && (!src || src === "-" || o.html != null || o.url))
        throw new Error("usage: --watch requires a file-based html-source");
      let html = o.url ? iframeForUrl(o.url) : await htmlSource(src, o);
      let security: any = {};
      if (o.url) security = await assertUrlAllowed(o.url, o.allowRemote);
      html = withBridge(html, o.csp ?? (o.allowRemoteResources || o.url ? undefined : DEFAULT_CSP));
      const watchPath = o.watch ? resolve(String(src)) : undefined;
      const res = await request("open", {
        html,
        name: o.name,
        replace: o.replace,
        options: options(o),
        source: o.url
          ? { kind: "url", url: o.url }
          : { kind: "html", path: src, watch: Boolean(o.watch) },
        bridge: !o.url || security.trusted || o.allowBridge,
        security,
        watchPath,
      });
      ok(res);
    }),
  );
addHtml(
  addWindow(
    program.command("set-html").description("Replace the HTML content of an existing window."),
  ),
)
  .addHelpText(
    "after",
    `
Example:
  $ glimpse set-html -w demo --html '<h1>Updated</h1>'`,
  )
  .action((src, o) =>
    run(async () =>
      ok(
        await request("set-html", {
          window: o.window,
          html: withBridge(
            await htmlSource(src, o),
            o.csp ?? (o.allowRemoteResources ? undefined : DEFAULT_CSP),
          ),
        }),
      ),
    ),
  );
addUrlPolicy(
  addWindow(
    program.command("navigate").description("Navigate an existing window to a URL."),
  ).requiredOption("--url <url>", "URL to navigate to."),
)
  .addHelpText(
    "after",
    `
Example:
  $ glimpse navigate -w demo --url http://localhost:3000`,
  )
  .action((o) =>
    run(async () => {
      await assertUrlAllowed(o.url, o.allowRemote);
      ok(await request("navigate", { window: o.window, url: o.url }));
    }),
  );
addWindow(program.command("send").description("Send a typed message into an existing window."))
  .requiredOption("--type <type>", "Message type, for example app.update.")
  .option("--data <json>", "JSON payload.")
  .option("--data-file <path>", "Read JSON payload from a file.")
  .option("--text <text>", "Plain text payload.")
  .addHelpText(
    "after",
    `
Example:
  $ glimpse send -w demo --type app.update --data '{"status":"working"}'`,
  )
  .action((o) =>
    run(async () => {
      const set = [o.data != null, o.dataFile != null, o.text != null].filter(Boolean).length;
      if (set !== 1) throw new Error("usage: choose exactly one of --data, --data-file, --text");
      const data =
        o.text ?? (o.dataFile ? await readDataFile(o.dataFile) : parseJson(o.data, "data JSON"));
      ok(await request("send", { window: o.window, type: o.type, data }));
    }),
  );
addWindow(
  program
    .command("eval")
    .description("Evaluate JavaScript in an existing window.")
    .argument("<js>", "JavaScript source to evaluate."),
)
  .addHelpText(
    "after",
    `
Example:
  $ glimpse eval -w demo 'document.title'`,
  )
  .action((js, o) => run(async () => ok(await request("eval", { window: o.window, js }))));
for (const name of ["read", "wait", "events", "peek"] as const) {
  const description =
    name === "wait"
      ? "Wait for and consume the next window event."
      : name === "read"
        ? "Read and consume one queued window event without waiting."
        : name === "peek"
          ? "Inspect one queued window event without consuming it."
          : "List queued window events without consuming them.";
  addWindow(program.command(name).description(description))
    .option("--type <type>", "Only match events with this type.")
    .option("--timeout <duration>", "Maximum wait time, for example 500ms, 30s, or 2m.")
    .addHelpText("after", "\nExample:\n  $ glimpse " + name + " -w demo --type form.saved")
    .action((o) =>
      run(async () =>
        ok(
          await request(name, {
            window: o.window,
            type: o.type,
            timeout: parseDuration(o.timeout),
          }),
        ),
      ),
    );
}
program
  .command("close")
  .description("Close one window or all windows.")
  .option("-w, --window <ref>", "Window id or name to close.")
  .option("--all", "Close all windows.")
  .option("--force", "Force close where supported.")
  .addHelpText(
    "after",
    `
Examples:
  $ glimpse close -w demo
  $ glimpse close --all`,
  )
  .action((o) =>
    run(async () => {
      if (!o.all && !o.window) throw new Error("usage: close requires -w or --all");
      ok(await request("close", { window: o.window, all: o.all, force: o.force }));
    }),
  );
program
  .command("list")
  .description("List known windows and daemon status.")
  .option("--include-closed", "Include closed windows retained by the daemon.")
  .action((o) =>
    run(async () => {
      try {
        ok(await request("list", { includeClosed: o.includeClosed }, false));
      } catch {
        ok({ daemon: { running: false }, windows: [] });
      }
    }),
  );
try {
  program.parse();
} catch (err) {
  const e = err as any;
  if (e.code === "commander.helpDisplayed" || e.code === "commander.version") process.exit(0);
  print({ ok: false, error: { code: "usage", message: e.message } });
  process.exit(2);
}
