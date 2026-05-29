#!/usr/bin/env node
import { a as socketPath, i as lockPath, n as promptWindow, r as withBridge } from "./glimpse-adapter-COgj6E-W.mjs";
import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
//#region src/ipc/client.ts
function daemonEntrypoint() {
	const bundled = new URL("./daemon-main.mjs", import.meta.url).pathname;
	if (existsSync(bundled)) return bundled;
	return new URL("../daemon-main.ts", import.meta.url).pathname;
}
async function ping() {
	try {
		await request("ping", {}, false);
		return true;
	} catch {
		return false;
	}
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function acquireStartupLock() {
	try {
		mkdirSync(lockPath());
		return true;
	} catch {
		return false;
	}
}
function releaseStartupLock() {
	rmSync(lockPath(), {
		recursive: true,
		force: true
	});
}
async function ensureDaemon() {
	if (await ping()) return;
	const deadline = Date.now() + 5e3;
	if (acquireStartupLock()) try {
		if (await ping()) return;
		spawn(process.execPath, [daemonEntrypoint()], {
			detached: true,
			stdio: "ignore",
			env: process.env
		}).unref();
		while (Date.now() < deadline) {
			if (await ping()) return;
			await sleep(100);
		}
		throw new Error("Daemon startup timed out");
	} finally {
		releaseStartupLock();
	}
	while (Date.now() < deadline) {
		if (await ping()) return;
		if (!existsSync(lockPath())) return ensureDaemon();
		await sleep(100);
	}
	releaseStartupLock();
	return ensureDaemon();
}
async function request(method, params, autostart = true) {
	if (autostart) await ensureDaemon();
	return new Promise((resolve, reject) => {
		const sock = new net.Socket();
		let buf = "";
		sock.on("error", reject);
		sock.on("connect", () => sock.write(JSON.stringify({
			id: randomUUID(),
			method,
			params
		}) + "\n"));
		sock.connect({ path: socketPath() });
		sock.on("data", (chunk) => {
			buf += chunk.toString();
			const i = buf.indexOf("\n");
			if (i >= 0) {
				sock.end();
				const res = JSON.parse(buf.slice(0, i));
				res.ok ? resolve(res.result) : reject(Object.assign(new Error(res.error.message), { code: res.error.code }));
			}
		});
	});
}
//#endregion
//#region src/utils/duration.ts
function parseDuration(input) {
	if (input == null || input === "") return void 0;
	const match = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(input.trim());
	if (!match) throw new Error(`Invalid duration: ${input}`);
	const n = Number(match[1]);
	const unit = match[2] ?? "ms";
	if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid duration: ${input}`);
	return unit === "m" ? n * 6e4 : unit === "s" ? n * 1e3 : n;
}
//#endregion
//#region src/utils/json.ts
function parseJson(input, label = "JSON") {
	try {
		return JSON.parse(input);
	} catch (err) {
		throw new Error(`Invalid ${label}: ${err.message}`);
	}
}
async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks).toString("utf8");
}
async function readDataFile(path) {
	return parseJson(path === "-" ? await readStdin() : readFileSync(path, "utf8"), path === "-" ? "stdin JSON" : `${path} JSON`);
}
//#endregion
//#region src/platform/url-policy.ts
function isLoopbackAddress(address) {
	if (net.isIPv4(address)) return address === "127.0.0.1" || address.startsWith("127.");
	if (net.isIPv6(address)) return address === "::1" || address === "0:0:0:0:0:0:0:1";
	return false;
}
async function classifyUrl(raw) {
	let url;
	try {
		url = new URL(raw);
	} catch {
		return {
			trusted: false,
			remote: true,
			reason: "invalid_url"
		};
	}
	if (url.protocol === "file:") return {
		trusted: true,
		remote: false,
		reason: "file"
	};
	if (url.protocol !== "http:" && url.protocol !== "https:") return {
		trusted: false,
		remote: true,
		reason: "unsupported_protocol"
	};
	const host = url.hostname;
	if (host === "localhost") return {
		trusted: true,
		remote: false,
		reason: "localhost"
	};
	if (isLoopbackAddress(host)) return {
		trusted: true,
		remote: false,
		reason: "loopback"
	};
	if (host.endsWith(".localhost")) {
		const answers = await lookup(host, { all: true });
		const ok = answers.length > 0 && answers.every((a) => isLoopbackAddress(a.address));
		return {
			trusted: ok,
			remote: !ok,
			reason: ok ? "localhost_subdomain" : "localhost_subdomain_non_loopback"
		};
	}
	return {
		trusted: false,
		remote: true,
		reason: "remote"
	};
}
async function assertUrlAllowed(raw, allowRemote) {
	const trust = await classifyUrl(raw);
	if (!trust.trusted && !allowRemote) throw new Error(`Remote URL blocked: ${raw}`);
	return trust;
}
//#endregion
//#region src/cli-helpers.ts
function escapeHtmlAttribute(value) {
	return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function iframeForUrl(rawUrl) {
	return `<iframe src="${escapeHtmlAttribute(new URL(rawUrl).href)}" style="border:0;width:100vw;height:100vh"></iframe>`;
}
//#endregion
//#region src/cli.ts
const DEFAULT_CSP = "default-src 'self' data: blob:; img-src 'self' data: blob: http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:* http://*.localhost:* https://*.localhost:*; style-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-inline' blob:; connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* http://127.0.0.1:* https://127.0.0.1:* ws://127.0.0.1:* wss://127.0.0.1:* http://*.localhost:* https://*.localhost:* ws://*.localhost:* wss://*.localhost:*; font-src 'self' data:; media-src 'self' data: blob:;";
function print(v) {
	console.log(JSON.stringify(v));
}
function ok(result) {
	print(result === void 0 ? { ok: true } : {
		ok: true,
		...result
	});
}
async function run(fn) {
	try {
		await fn();
	} catch (err) {
		print({
			ok: false,
			error: {
				code: err.code ?? "command_failed",
				message: err.message
			}
		});
		process.exitCode = /usage|Invalid/.test(err.message) ? 2 : 1;
	}
}
async function htmlSource(src, opts) {
	if (opts.html != null) return String(opts.html);
	if (src === "-") return readStdin();
	if (!src) throw new Error("usage: missing html-source");
	return readFileSync(src, "utf8");
}
function options(o) {
	const base = o.optionsJson ? parseJson(o.optionsJson, "options JSON") : {};
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
		"followMode"
	]) if (o[k] != null) base[k] = o[k];
	if (o.cursorOffset) {
		const [x, y] = String(o.cursorOffset).split(",").map(Number);
		base.cursorOffset = {
			x,
			y
		};
	}
	return base;
}
function addWindow(c) {
	return c.requiredOption("-w, --window <ref>");
}
function addUrlPolicy(c) {
	return c.option("--allow-remote");
}
function addHtmlPolicy(c) {
	return c.option("--allow-remote-resources").option("--csp <policy>");
}
function addOpenPolicy(c) {
	return addHtmlPolicy(addUrlPolicy(c).option("--allow-bridge"));
}
function addPromptPolicy(c) {
	return addHtmlPolicy(addUrlPolicy(c).option("--allow-bridge"));
}
function addHtml(c) {
	return addHtmlPolicy(c.argument("[html-source]").option("--html <literal>"));
}
function addOpts(c) {
	return c.option("--name <name>").option("--replace").option("--options-json <json>").option("--width <n>", "", Number).option("--height <n>", "", Number).option("--title <title>").option("--x <n>", "", Number).option("--y <n>", "", Number).option("--frameless").option("--floating").option("--transparent").option("--click-through").option("--follow-cursor").option("--follow-mode <mode>").option("--cursor-offset <x,y>");
}
const program = new Command().name("glimpse").showHelpAfterError().exitOverride();
addOpts(addPromptPolicy(program.command("prompt").argument("[html-source]").option("--html <literal>"))).option("--url <url>").option("--timeout <duration>").action((src, o) => run(async () => {
	let html = o.url ? iframeForUrl(o.url) : await htmlSource(src, o);
	if (o.url) {
		if (!(await assertUrlAllowed(o.url, o.allowRemote)).trusted && !o.allowBridge) throw new Error("Remote URL prompts require --allow-bridge.");
	}
	const res = await promptWindow(withBridge(html, o.csp ?? (o.allowRemoteResources ? void 0 : DEFAULT_CSP)), {
		...options(o),
		timeout: parseDuration(o.timeout)
	});
	ok({ result: res === null ? { type: "window.closed" } : res });
}));
addOpts(addOpenPolicy(program.command("open").argument("[html-source]").option("--html <literal>"))).option("--url <url>").option("--watch").action((src, o) => run(async () => {
	if (o.watch && (!src || src === "-" || o.html != null || o.url)) throw new Error("usage: --watch requires a file-based html-source");
	let html = o.url ? iframeForUrl(o.url) : await htmlSource(src, o);
	let security = {};
	if (o.url) security = await assertUrlAllowed(o.url, o.allowRemote);
	html = withBridge(html, o.csp ?? (o.allowRemoteResources || o.url ? void 0 : DEFAULT_CSP));
	const watchPath = o.watch ? resolve(String(src)) : void 0;
	ok(await request("open", {
		html,
		name: o.name,
		replace: o.replace,
		options: options(o),
		source: o.url ? {
			kind: "url",
			url: o.url
		} : {
			kind: "html",
			path: src,
			watch: Boolean(o.watch)
		},
		bridge: !o.url || security.trusted || o.allowBridge,
		security,
		watchPath
	}));
}));
addHtml(addWindow(program.command("set-html"))).action((src, o) => run(async () => ok(await request("set-html", {
	window: o.window,
	html: withBridge(await htmlSource(src, o), o.csp ?? (o.allowRemoteResources ? void 0 : DEFAULT_CSP))
}))));
addUrlPolicy(addWindow(program.command("navigate")).requiredOption("--url <url>")).action((o) => run(async () => {
	await assertUrlAllowed(o.url, o.allowRemote);
	ok(await request("navigate", {
		window: o.window,
		url: o.url
	}));
}));
addWindow(program.command("send")).requiredOption("--type <type>").option("--data <json>").option("--data-file <path>").option("--text <text>").action((o) => run(async () => {
	if ([
		o.data != null,
		o.dataFile != null,
		o.text != null
	].filter(Boolean).length !== 1) throw new Error("usage: choose exactly one of --data, --data-file, --text");
	const data = o.text ?? (o.dataFile ? await readDataFile(o.dataFile) : parseJson(o.data, "data JSON"));
	ok(await request("send", {
		window: o.window,
		type: o.type,
		data
	}));
}));
addWindow(program.command("eval").argument("<js>")).action((js, o) => run(async () => ok(await request("eval", {
	window: o.window,
	js
}))));
for (const name of [
	"read",
	"wait",
	"events",
	"peek"
]) addWindow(program.command(name)).option("--type <type>").option("--timeout <duration>").action((o) => run(async () => ok(await request(name, {
	window: o.window,
	type: o.type,
	timeout: parseDuration(o.timeout)
}))));
program.command("close").option("-w, --window <ref>").option("--all").option("--force").action((o) => run(async () => {
	if (!o.all && !o.window) throw new Error("usage: close requires -w or --all");
	ok(await request("close", {
		window: o.window,
		all: o.all,
		force: o.force
	}));
}));
program.command("list").option("--include-closed").action((o) => run(async () => {
	try {
		ok(await request("list", { includeClosed: o.includeClosed }, false));
	} catch {
		ok({
			daemon: { running: false },
			windows: []
		});
	}
}));
try {
	program.parse();
} catch (err) {
	const e = err;
	if (e.code === "commander.helpDisplayed") process.exit(0);
	print({
		ok: false,
		error: {
			code: "usage",
			message: e.message
		}
	});
	process.exit(2);
}
//#endregion
export {};

//# sourceMappingURL=cli.mjs.map