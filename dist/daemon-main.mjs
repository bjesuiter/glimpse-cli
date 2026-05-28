#!/usr/bin/env node
import { a as socketPath, o as statePath, t as openWindow } from "./glimpse-adapter-g-UHqPu4.mjs";
import { unlinkSync, writeFileSync } from "node:fs";
import net from "node:net";
import { randomUUID } from "node:crypto";
import * as v from "valibot";
//#region src/ipc/protocol.ts
const RequestSchema = v.object({
	id: v.string(),
	method: v.string(),
	params: v.optional(v.any())
});
const ok = (id, result) => ({
	id,
	ok: true,
	result
});
const fail = (id, code, message) => ({
	id,
	ok: false,
	error: {
		code,
		message
	}
});
//#endregion
//#region src/ipc/server.ts
function serve(dispatch) {
	try {
		unlinkSync(socketPath());
	} catch {}
	const server = net.createServer((sock) => {
		let buf = "";
		sock.on("data", async (chunk) => {
			buf += chunk.toString();
			for (;;) {
				const i = buf.indexOf("\n");
				if (i < 0) break;
				const line = buf.slice(0, i);
				buf = buf.slice(i + 1);
				if (!line.trim()) continue;
				let id = "unknown";
				try {
					const req = v.parse(RequestSchema, JSON.parse(line));
					id = req.id;
					sock.write(JSON.stringify(ok(id, await dispatch(req.method, req.params))) + "\n");
				} catch (err) {
					sock.write(JSON.stringify(fail(id, "command_failed", err.message)) + "\n");
				}
			}
		});
	});
	server.listen(socketPath(), () => writeFileSync(statePath(), JSON.stringify({
		pid: process.pid,
		socketPath: socketPath(),
		startedAt: (/* @__PURE__ */ new Date()).toISOString()
	})));
	return server;
}
//#endregion
//#region src/daemon/event-queue.ts
var EventQueue = class {
	max;
	events = [];
	seq = 0;
	constructor(max = 1e3) {
		this.max = max;
		this.max = Math.min(Math.max(max, 1), 2e4);
	}
	push(type, data) {
		if (type.startsWith("window.") || type.startsWith("glimpse.") || type.startsWith("html.")) type = "glimpse.error";
		this.events.push({
			id: ++this.seq,
			type,
			data,
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		});
		if (this.events.length > this.max) this.events.shift();
	}
	system(type, data) {
		this.events.push({
			id: ++this.seq,
			type,
			data,
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		});
		if (this.events.length > this.max) this.events.shift();
	}
	peek(type) {
		return type ? this.events.filter((e) => e.type === type) : [...this.events];
	}
	read(type) {
		const i = type ? this.events.findIndex((e) => e.type === type) : 0;
		return i < 0 ? null : this.events.splice(i, 1)[0];
	}
	get size() {
		return this.events.length;
	}
};
//#endregion
//#region src/daemon/window-registry.ts
var WindowRegistry = class {
	windows = /* @__PURE__ */ new Map();
	resolve(ref) {
		return this.windows.get(ref) ?? [...this.windows.values()].find((w) => w.name === ref && w.state === "open");
	}
	list(includeClosed = false) {
		const now = Date.now();
		return [...this.windows.values()].filter((w) => w.state === "open" || includeClosed && (w.expiresAt ?? 0) > now).map((w) => ({
			windowId: w.id,
			name: w.name,
			state: w.state,
			eventQueueSize: w.queue.size,
			source: w.source,
			bridge: w.bridge,
			security: w.security,
			expiresAt: w.expiresAt ? new Date(w.expiresAt).toISOString() : void 0
		}));
	}
	open(html, opts = {}) {
		if (opts.name) {
			const old = this.resolve(opts.name);
			if (old && !opts.replace) throw new Error(`Window name is already in use: ${opts.name}`);
			if (old) this.close(old.id, true);
		}
		const rec = {
			id: `win_${randomUUID()}`,
			name: opts.name,
			state: "open",
			source: opts.source,
			bridge: opts.bridge ?? true,
			security: opts.security,
			queue: new EventQueue(),
			win: openWindow(html, opts.options ?? {})
		};
		this.windows.set(rec.id, rec);
		rec.win?.once("ready", () => rec.queue.system("window.ready"));
		rec.win?.on("message", (data) => rec.queue.push(typeof data === "object" && data && "type" in data ? String(data.type) : "json", data));
		rec.win?.once("closed", () => this.markClosed(rec));
		rec.win?.on("error", (err) => rec.queue.system("glimpse.error", { message: String(err?.message ?? err) }));
		return rec;
	}
	setHtml(ref, html) {
		const w = this.must(ref);
		w.win.setHTML(html);
		w.source = { kind: "html" };
		w.queue.system("html.reloaded");
		return w;
	}
	eval(ref, js) {
		this.must(ref).win.send(`Promise.resolve(${js}).then(r=>window.glimpse?.send({type:'eval.result',data:r})).catch(e=>window.glimpse?.send({type:'glimpse.error',data:{message:String(e)}}))`);
	}
	send(ref, type, data) {
		const w = this.must(ref);
		if (!w.bridge) throw new Error("Window has no bridge");
		w.win.send(`window.dispatchEvent(new CustomEvent('glimpse-message',{detail:${JSON.stringify({
			type,
			data
		})}}))`);
	}
	close(ref, force = false) {
		const w = this.must(ref);
		if (force) {
			w.win?.close();
			this.windows.delete(w.id);
			return;
		}
		w.win?.close();
		this.markClosed(w);
	}
	closeAll(force = false) {
		for (const w of [...this.windows.values()].filter((w) => w.state === "open")) this.close(w.id, force);
	}
	must(ref) {
		const w = this.resolve(ref);
		if (!w || w.state !== "open") throw new Error(`Window ${ref} is not open.`);
		return w;
	}
	markClosed(w) {
		if (w.state === "closed") return;
		w.state = "closed";
		w.queue.system("window.closed");
		w.closedAt = Date.now();
		w.expiresAt = w.closedAt + 3e4;
		w.name = void 0;
		setTimeout(() => this.windows.delete(w.id), 3e4).unref?.();
	}
};
//#endregion
//#region src/daemon/daemon.ts
const registry = new WindowRegistry();
async function dispatch(method, p = {}) {
	switch (method) {
		case "ping": return { pong: true };
		case "open": {
			const w = registry.open(p.html, p);
			return {
				windowId: w.id,
				name: w.name
			};
		}
		case "set-html":
			registry.setHtml(p.window, p.html);
			return { ok: true };
		case "navigate":
			registry.setHtml(p.window, `<script>location.href=${JSON.stringify(p.url)}<\/script>`);
			return { ok: true };
		case "send":
			registry.send(p.window, p.type, p.data);
			return { ok: true };
		case "eval":
			registry.eval(p.window, p.js);
			return { ok: true };
		case "read": return { event: registry.resolve(p.window)?.queue.read(p.type) ?? null };
		case "peek":
		case "events": return { events: registry.resolve(p.window)?.queue.peek(p.type) ?? [] };
		case "wait": return wait(p.window, p.type, p.timeout);
		case "close":
			p.all ? registry.closeAll(p.force) : registry.close(p.window, p.force);
			return { ok: true };
		case "list": return {
			daemon: { running: true },
			windows: registry.list(p.includeClosed)
		};
		default: throw new Error(`Unknown IPC method: ${method}`);
	}
}
function wait(window, type, timeout) {
	return new Promise((resolve, reject) => {
		const deadline = timeout ? setTimeout(() => {
			clearInterval(iv);
			reject(/* @__PURE__ */ new Error("timeout"));
		}, timeout) : null;
		const iv = setInterval(() => {
			const ev = registry.resolve(window)?.queue.read(type);
			if (ev) {
				if (deadline) clearTimeout(deadline);
				clearInterval(iv);
				resolve({ event: ev });
			}
		}, 50);
	});
}
//#endregion
//#region src/daemon-main.ts
serve(dispatch);
//#endregion
export {};

//# sourceMappingURL=daemon-main.mjs.map