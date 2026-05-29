import net from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { socketPath, lockPath } from '../platform/paths.ts';

function isCompiledExecutableUrl(url: string): boolean {
  return url.startsWith('file:///$bunfs/');
}

function daemonEntrypoint(metaUrl = import.meta.url) {
  const bundled = new URL('./daemon-main.mjs', metaUrl).pathname;
  if (existsSync(bundled)) return bundled;
  return new URL('../daemon-main.ts', metaUrl).pathname;
}

export function daemonSpawnCommand(metaUrl = import.meta.url, execPath = process.execPath) {
  if (isCompiledExecutableUrl(metaUrl)) return { command: execPath, args: ['--glimpse-daemon'] };
  return { command: execPath, args: [daemonEntrypoint(metaUrl)] };
}

async function ping() { try { await request('ping', {}, false); return true; } catch { return false; } }
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function acquireStartupLock() {
  try {
    mkdirSync(lockPath());
    return true;
  } catch {
    return false;
  }
}

function releaseStartupLock() {
  rmSync(lockPath(), { recursive: true, force: true });
}

export async function ensureDaemon() {
  if (await ping()) return;

  const deadline = Date.now() + 5000;
  const ownsLock = acquireStartupLock();

  if (ownsLock) {
    try {
      // Another process may have started the daemon between our first ping and
      // lock acquisition. Re-check before spawning to avoid duplicate daemons.
      if (await ping()) return;
      const daemon = daemonSpawnCommand();
      spawn(daemon.command, daemon.args, { detached: true, stdio: 'ignore', env: process.env }).unref();
      while (Date.now() < deadline) {
        if (await ping()) return;
        await sleep(100);
      }
      throw new Error('Daemon startup timed out');
    } finally {
      releaseStartupLock();
    }
  }

  // A peer owns startup. Do not spawn; wait for the daemon to answer or for the
  // peer to release the lock, then retry as the potential new owner.
  while (Date.now() < deadline) {
    if (await ping()) return;
    if (!existsSync(lockPath())) return ensureDaemon();
    await sleep(100);
  }

  releaseStartupLock();
  return ensureDaemon();
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
