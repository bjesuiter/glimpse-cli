import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    'daemon-main': 'src/daemon-main.ts',
  },
  outDir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node20',
  clean: true,
  dts: false,
  sourcemap: true,
  shims: true,
});
