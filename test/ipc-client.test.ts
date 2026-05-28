import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request } from '../src/ipc/client.ts';
import { socketPath } from '../src/platform/paths.ts';

const tmpRoots: string[] = [];

function isolatedRuntime() {
  const dir = mkdtempSync(join(tmpdir(), 'glimpse-ipc-'));
  tmpRoots.push(dir);
  process.env.TMPDIR = dir;
  return dir;
}

describe('ipc client daemon recovery', () => {
  test('autostart recovers when a stale socket path already exists', async () => {
    isolatedRuntime();
    writeFileSync(socketPath(), 'stale socket placeholder');

    const result = await request('ping');

    expect(result).toEqual({ pong: true });
  }, 10_000);
});

afterAll(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});
