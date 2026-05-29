#!/usr/bin/env bun
import { prepareCompiledGlimpseHost } from './runtime/compiled-assets.ts';

prepareCompiledGlimpseHost();

if (process.argv.some(arg => arg.endsWith('/chromium-backend.mjs'))) {
  // Linux Glimpse falls back to this JS backend when no native host is present.
  // In compiled Bun executables, glimpseui spawns process.execPath with the
  // embedded backend path as argv[2], so route that invocation explicitly.
  // @ts-ignore TypeScript cannot type a package-private dependency module.
  await import('../node_modules/glimpseui/src/chromium-backend.mjs');
} else if (process.argv.includes('--glimpse-daemon')) {
  const { serve } = await import('./ipc/server.ts');
  const { dispatch } = await import('./daemon/daemon.ts');
  serve(dispatch);
} else {
  await import('./cli.ts');
}
