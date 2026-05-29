#!/usr/bin/env bun
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = join(import.meta.dir, '..');
const distDir = join(root, 'dist');
const hostDir = join(root, '.build', 'glimpse-hosts');
const swiftSource = join(root, 'node_modules', 'glimpseui', 'src', 'glimpse.swift');

type Target = { bun: string; out: string };

const targets: Target[] = [
  { bun: 'bun-darwin-arm64', out: 'glimpse-darwin-arm64' },
  { bun: 'bun-linux-arm64', out: 'glimpse-linux-arm64' },
  { bun: 'bun-linux-x64', out: 'glimpse-linux-x64' },
  { bun: 'bun-windows-arm64', out: 'glimpse-windows-arm64.exe' },
  { bun: 'bun-windows-x64', out: 'glimpse-windows-x64.exe' },
];

function run(command: string, args: string[], options: { cwd?: string } = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd ?? root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function commandExists(command: string) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(probe, [command], { stdio: 'ignore', shell: false }).status === 0;
}

function ensurePlaceholder(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) writeFileSync(path, 'placeholder');
}

function prepareDarwinHost() {
  const output = join(hostDir, 'darwin-arm64', 'glimpse');
  mkdirSync(dirname(output), { recursive: true });

  if (process.platform !== 'darwin') {
    ensurePlaceholder(output);
    return;
  }
  if (existsSync(output)) return;
  if (!commandExists('swiftc') || !commandExists('lipo')) {
    throw new Error('Preparing the bundled macOS Glimpse host requires swiftc and lipo.');
  }

  const tmp = join(root, '.build', 'tmp', 'darwin-host');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  run('swiftc', ['-O', '-target', 'arm64-apple-macosx13.0', swiftSource, '-o', output]);
}

function prepareWindowsHost(selectedTargets: Target[]) {
  const output = join(hostDir, 'win32', 'glimpse.exe');
  mkdirSync(dirname(output), { recursive: true });

  if (process.platform !== 'win32') {
    ensurePlaceholder(output);
    return;
  }
  if (existsSync(output)) return;
  if (!commandExists('dotnet')) throw new Error('Preparing the bundled Windows Glimpse host requires dotnet.');

  const windowsTarget = selectedTargets.find(target => target.bun.includes('windows'));
  process.env.GLIMPSE_WINDOWS_RUNTIME = windowsTarget?.bun.includes('arm64') ? 'win-arm64' : 'win-x64';
  run('node', ['scripts/build.mjs', 'win32'], { cwd: join(root, 'node_modules', 'glimpseui') });
  copyFileSync(join(root, 'node_modules', 'glimpseui', 'native', 'windows', 'bin', 'glimpse.exe'), output);
}

function currentTarget(): Target {
  const os = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return targets.find(target => target.bun === `bun-${os}-${arch}`) ?? targets[0];
}

function parseSelectedTargets(): Target[] {
  const targetArg = process.argv.find(arg => arg.startsWith('--target='))?.slice('--target='.length);
  if (targetArg) {
    const target = targets.find(candidate => candidate.bun === targetArg || candidate.out === targetArg);
    if (!target) throw new Error(`Unsupported target: ${targetArg}`);
    return [target];
  }
  if (process.argv.includes('--current')) return [currentTarget()];
  return targets;
}

function build(target: Target) {
  const outfile = join(distDir, target.out);
  run('bun', ['build', '--compile', `--target=${target.bun}`, `--outfile=${outfile}`, 'src/bin.ts']);
}

mkdirSync(distDir, { recursive: true });
const selectedTargets = parseSelectedTargets();
prepareDarwinHost();
prepareWindowsHost(selectedTargets);

for (const target of selectedTargets) build(target);
