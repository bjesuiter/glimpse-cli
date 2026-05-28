import { afterAll, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { socketPath } from '../src/platform/paths.ts';

const tmpRoots: string[] = [];

function isolatedRuntime() {
  const dir = mkdtempSync(join(tmpdir(), 'glimpse-list-'));
  tmpRoots.push(dir);
  return dir;
}

describe('list command liveness probing', () => {
  test('reports daemon stopped when only a stale socket path exists', () => {
    const runtimeDir = isolatedRuntime();
    const previousTmpdir = process.env.TMPDIR;
    process.env.TMPDIR = runtimeDir;
    writeFileSync(socketPath(), 'stale socket placeholder');
    process.env.TMPDIR = previousTmpdir;

    const output = execFileSync(process.execPath, ['src/cli.ts', 'list'], {
      env: { ...process.env, TMPDIR: runtimeDir },
      encoding: 'utf8',
      timeout: 10_000,
    });

    const result = JSON.parse(output);
    expect(result.ok).toBe(true);
    expect(result.daemon.running).toBe(false);
    expect(result.windows).toEqual([]);
  });
});

afterAll(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});
