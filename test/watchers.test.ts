import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { watchHtmlFile } from '../src/daemon/watchers.ts';

const tmpRoots: string[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('HTML file watching', () => {
  test('reloads changed file contents', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'glimpse-watch-'));
    tmpRoots.push(dir);
    const file = join(dir, 'index.html');
    writeFileSync(file, '<h1>old</h1>');

    const reloads: string[] = [];
    const watcher = watchHtmlFile(file, { setHtml: html => reloads.push(html) });
    writeFileSync(file, '<h1>new</h1>');

    for (let i = 0; i < 20 && reloads.length === 0; i++) await sleep(50);
    watcher.close();

    expect(reloads).toContain('<h1>new</h1>');
  });
});

afterAll(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});
