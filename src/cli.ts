#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { request } from './ipc/client.ts';
import { parseDuration } from './utils/duration.ts';
import { parseJson, readDataFile, readStdin } from './utils/json.ts';
import { assertUrlAllowed } from './platform/url-policy.ts';
import { promptWindow, withBridge } from './runtime/glimpse-adapter.ts';
import { iframeForUrl } from './cli-helpers.ts';

const DEFAULT_CSP = "default-src 'self' data: blob:; img-src 'self' data: blob: http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:* http://*.localhost:* https://*.localhost:*; style-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-inline' blob:; connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* http://127.0.0.1:* https://127.0.0.1:* ws://127.0.0.1:* wss://127.0.0.1:* http://*.localhost:* https://*.localhost:* ws://*.localhost:* wss://*.localhost:*; font-src 'self' data:; media-src 'self' data: blob:;";

function print(v: unknown) { console.log(JSON.stringify(v)); }
function ok(result?: unknown) { print(result === undefined ? { ok: true } : { ok: true, ...result as any }); }
async function run(fn: () => Promise<void>) { try { await fn(); } catch (err) { print({ ok: false, error: { code: (err as any).code ?? 'command_failed', message: (err as Error).message } }); process.exitCode = /usage|Invalid/.test((err as Error).message) ? 2 : 1; } }
async function htmlSource(src: string|undefined, opts: any) { if (opts.html != null) return String(opts.html); if (src === '-') return readStdin(); if (!src) throw new Error('usage: missing html-source'); return readFileSync(src, 'utf8'); }
function options(o: any) { const base = o.optionsJson ? parseJson(o.optionsJson, 'options JSON') as any : {}; for (const k of ['width','height','title','x','y','frameless','floating','transparent','clickThrough','followCursor','followMode']) if (o[k] != null) base[k] = o[k]; if (o.cursorOffset) { const [x,y] = String(o.cursorOffset).split(',').map(Number); base.cursorOffset = { x, y }; } return base; }
function addWindow(c: Command) { return c.requiredOption('-w, --window <ref>'); }
function addUrlPolicy(c: Command) { return c.option('--allow-remote'); }
function addHtmlPolicy(c: Command) { return c.option('--allow-remote-resources').option('--csp <policy>'); }
function addOpenPolicy(c: Command) { return addHtmlPolicy(addUrlPolicy(c).option('--allow-bridge')); }
function addPromptPolicy(c: Command) { return addHtmlPolicy(addUrlPolicy(c).option('--allow-bridge')); }
function addHtml(c: Command) { return addHtmlPolicy(c.argument('[html-source]').option('--html <literal>')); }
function addOpts(c: Command) { return c.option('--name <name>').option('--replace').option('--options-json <json>').option('--width <n>', '', Number).option('--height <n>', '', Number).option('--title <title>').option('--x <n>', '', Number).option('--y <n>', '', Number).option('--frameless').option('--floating').option('--transparent').option('--click-through').option('--follow-cursor').option('--follow-mode <mode>').option('--cursor-offset <x,y>'); }

const program = new Command().name('glimpse').showHelpAfterError().exitOverride();
addOpts(addPromptPolicy(program.command('prompt').argument('[html-source]').option('--html <literal>'))).option('--url <url>').option('--timeout <duration>').action((src, o) => run(async () => { let html = o.url ? iframeForUrl(o.url) : await htmlSource(src, o); if (o.url) { const security = await assertUrlAllowed(o.url, o.allowRemote); if (!security.trusted && !o.allowBridge) throw new Error('Remote URL prompts require --allow-bridge.'); } const res = await promptWindow(withBridge(html, o.csp ?? (o.allowRemoteResources ? undefined : DEFAULT_CSP)), { ...options(o), timeout: parseDuration(o.timeout) }); ok({ result: res === null ? { type: 'window.closed' } : res }); }));
addOpts(addOpenPolicy(program.command('open').argument('[html-source]').option('--html <literal>'))).option('--url <url>').option('--watch').action((src, o) => run(async () => { if (o.watch && (!src || src === '-' || o.html != null || o.url)) throw new Error('usage: --watch requires a file-based html-source'); let html = o.url ? iframeForUrl(o.url) : await htmlSource(src, o); let security:any={}; if (o.url) security = await assertUrlAllowed(o.url, o.allowRemote); html = withBridge(html, o.csp ?? (o.allowRemoteResources || o.url ? undefined : DEFAULT_CSP)); const watchPath = o.watch ? resolve(String(src)) : undefined; const res = await request('open', { html, name: o.name, replace: o.replace, options: options(o), source: o.url ? { kind:'url', url:o.url } : { kind:'html', path: src, watch: Boolean(o.watch) }, bridge: !o.url || security.trusted || o.allowBridge, security, watchPath }); ok(res); }));
addHtml(addWindow(program.command('set-html'))).action((src, o) => run(async () => ok(await request('set-html', { window: o.window, html: withBridge(await htmlSource(src,o), o.csp ?? (o.allowRemoteResources ? undefined : DEFAULT_CSP)) }))));
addUrlPolicy(addWindow(program.command('navigate')).requiredOption('--url <url>')).action(o => run(async () => { await assertUrlAllowed(o.url, o.allowRemote); ok(await request('navigate', { window:o.window, url:o.url })); }));
addWindow(program.command('send')).requiredOption('--type <type>').option('--data <json>').option('--data-file <path>').option('--text <text>').action(o => run(async () => { const set = [o.data!=null,o.dataFile!=null,o.text!=null].filter(Boolean).length; if (set !== 1) throw new Error('usage: choose exactly one of --data, --data-file, --text'); const data = o.text ?? (o.dataFile ? await readDataFile(o.dataFile) : parseJson(o.data,'data JSON')); ok(await request('send', { window:o.window, type:o.type, data })); }));
addWindow(program.command('eval').argument('<js>')).action((js,o) => run(async () => ok(await request('eval', { window:o.window, js }))));
for (const name of ['read','wait','events','peek'] as const) addWindow(program.command(name)).option('--type <type>').option('--timeout <duration>').action(o => run(async () => ok(await request(name, { window:o.window, type:o.type, timeout:parseDuration(o.timeout) }))));
program.command('close').option('-w, --window <ref>').option('--all').option('--force').action(o => run(async () => { if (!o.all && !o.window) throw new Error('usage: close requires -w or --all'); ok(await request('close', { window:o.window, all:o.all, force:o.force })); }));
program.command('list').option('--include-closed').action(o => run(async () => { try { ok(await request('list', { includeClosed:o.includeClosed }, false)); } catch { ok({ daemon:{ running:false }, windows:[] }); } }));
try { program.parse(); } catch (err) {
  const e = err as any;
  if (e.code === 'commander.helpDisplayed') process.exit(0);
  print({ ok:false, error:{ code:'usage', message:e.message } });
  process.exit(2);
}
