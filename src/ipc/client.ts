import net from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { socketPath, lockPath } from '../platform/paths.ts';

function daemonEntrypoint() {
  const bundled = new URL('./daemon-main.mjs', import.meta.url).pathname;
  if (existsSync(bundled)) return bundled;
  return new URL('../daemon-main.ts', import.meta.url).pathname;
}

async function ping() { try { await request('ping', {}, false); return true; } catch { return false; } }
export async function ensureDaemon() {
  if (await ping()) return;
  try { mkdirSync(lockPath()); } catch {}
  spawn(process.execPath, [daemonEntrypoint()], { detached: true, stdio: 'ignore', env: process.env }).unref();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) { if (await ping()) { try { rmdirSync(lockPath()); } catch {} ; return; } await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Daemon startup timed out');
}

export async function request(method: string, params?: unknown, autostart = true): Promise<any> {
  // Always ping before autostarted requests. A crashed daemon can leave a stale
  // Unix socket path behind; checking only existsSync(socketPath()) would then
  // skip startup and fail forever with ECONNREFUSED.
  if (autostart) await ensureDaemon();
  return new Promise((resolve, reject) => {
    const sock = new net.Socket(); let buf = '';
    sock.on('error', reject);
    sock.on('connect', () => sock.write(JSON.stringify({ id: randomUUID(), method, params }) + '\n'));
    sock.connect({ path: socketPath() });
    sock.on('data', chunk => { buf += chunk.toString(); const i = buf.indexOf('\n'); if (i >= 0) { sock.end(); const res = JSON.parse(buf.slice(0, i)); res.ok ? resolve(res.result) : reject(Object.assign(new Error(res.error.message), { code: res.error.code })); } });
  });
}
