import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as glimpse from "glimpseui";
//#region src/platform/paths.ts
function runtimeDir() {
	const uid = typeof process.getuid === "function" ? process.getuid() : process.env.USER ?? "user";
	const dir = join(process.env.TMPDIR || tmpdir(), `glimpse-cli-${uid}`);
	mkdirSync(dir, {
		recursive: true,
		mode: 448
	});
	return dir;
}
const socketPath = () => join(runtimeDir(), "daemon.sock");
const statePath = () => join(runtimeDir(), "daemon.json");
const lockPath = () => join(runtimeDir(), "daemon.lock");
//#endregion
//#region src/runtime/glimpse-adapter.ts
function withBridge(html, csp) {
	const meta = csp ? `<meta http-equiv="Content-Security-Policy" content="${csp.replaceAll("\"", "&quot;")}">` : "";
	const bridgeHint = "<script>window.dispatchEvent(new Event(\"glimpse:loaded\"));<\/script>";
	return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${meta}${bridgeHint}`) : `${meta}${bridgeHint}${html}`;
}
function openWindow(html, options = {}) {
	return glimpse.open(html, options);
}
async function promptWindow(html, options = {}) {
	return glimpse.prompt(html, options);
}
//#endregion
export { socketPath as a, lockPath as i, promptWindow as n, statePath as o, withBridge as r, openWindow as t };

//# sourceMappingURL=glimpse-adapter-COgj6E-W.mjs.map