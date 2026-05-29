import { describe, expect, test } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';

function cli(args: string[]) {
  return execFileSync(process.execPath, ['src/cli.ts', ...args], { encoding: 'utf8' });
}

describe('CLI option surface', () => {
  test('navigate only advertises URL loading policy flags it uses', () => {
    const help = cli(['navigate', '--help']);
    expect(help).toContain('--allow-remote');
    expect(help).not.toContain('--allow-bridge');
    expect(help).not.toContain('--allow-remote-resources');
    expect(help).not.toContain('--csp');
  });

  test('set-html only advertises HTML policy flags it uses', () => {
    const help = cli(['set-html', '--help']);
    expect(help).toContain('--allow-remote-resources');
    expect(help).toContain('--csp <policy>');
    expect(help).not.toContain('--allow-remote\n');
    expect(help).not.toContain('--allow-bridge');
  });

  test('unsupported policy flags are rejected instead of silently ignored', () => {
    const result = spawnSync(process.execPath, ['src/cli.ts', 'navigate', '-w', 'x', '--url', 'http://localhost', '--csp', "default-src 'self'"], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('unknown option');
  });
});
