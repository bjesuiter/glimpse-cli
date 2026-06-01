const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const bin = process.platform === 'win32'
  ? join(__dirname, '..', 'node_modules', '.bin', 'glimpse.cmd')
  : join(__dirname, '..', 'node_modules', '.bin', 'glimpse');

function run(args, options = {}) {
  return execFileSync(bin, args, {
    cwd: join(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
    ...options,
  });
}

describe('npm-installed glimpse-cli', () => {
  it('prints help from the npm bin', () => {
    const output = run(['--help']);
    assert.match(output, /Usage: glimpse/);
    assert.match(output, /Commands:/);
  });

  it('lists no windows without starting a daemon', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'glimpse-npm-playground-'));
    try {
      const output = run(['list'], { env: { ...process.env, TMPDIR: runtimeDir } });
      assert.deepEqual(JSON.parse(output), {
        ok: true,
        daemon: { running: false },
        windows: [],
      });
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });
});
