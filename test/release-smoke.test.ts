import { afterAll, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const tmpRoots: string[] = [];

function tempDir(prefix: string) {
  mkdirSync(tmpdir(), { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpRoots.push(dir);
  return dir;
}

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });
}

describe('release package smoke test', () => {
  test('packed npm install exposes a Node-runnable glimpse list binary', () => {
    const packDir = tempDir('glimpse-pack-');
    const installDir = tempDir('glimpse-install-');
    const runtimeDir = tempDir('glimpse-runtime-');

    run('npm', ['pack', '--pack-destination', packDir]);
    const tarballName = readdirSync(packDir).find((name) => name.endsWith('.tgz'));
    expect(tarballName).toBeString();
    const tarball = join(packDir, tarballName!);

    run('npm', ['init', '-y'], { cwd: installDir });
    run('npm', ['install', '--ignore-scripts', tarball], { cwd: installDir });

    const nodeOnlyPath = [dirname(process.execPath), dirname(run('which', ['npm']).trim())].join(':');
    const output = run(join(installDir, 'node_modules/.bin/glimpse'), ['list'], {
      cwd: installDir,
      env: {
        PATH: nodeOnlyPath,
        TMPDIR: runtimeDir,
        HOME: installDir,
      },
    });

    const result = JSON.parse(output);
    expect(result.ok).toBe(true);
    expect(result.daemon.running).toBe(false);
    expect(result.windows).toEqual([]);
  }, 180_000);
});

afterAll(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});
