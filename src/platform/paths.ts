import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function runtimeDir(): string {
  const uid = typeof process.getuid === 'function' ? process.getuid() : process.env.USER ?? 'user';
  const dir = join(process.env.TMPDIR || tmpdir(), `glimpse-cli-${uid}`);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
export const socketPath = () => join(runtimeDir(), 'daemon.sock');
export const statePath = () => join(runtimeDir(), 'daemon.json');
export const lockPath = () => join(runtimeDir(), 'daemon.lock');
