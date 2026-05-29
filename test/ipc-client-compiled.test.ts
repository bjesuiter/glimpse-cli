import { describe, expect, test } from 'bun:test';
import { daemonSpawnCommand } from '../src/ipc/client.ts';

describe('ipc client compiled executable support', () => {
  test('spawns the compiled binary in daemon mode when running from bunfs', () => {
    expect(daemonSpawnCommand('file:///$bunfs/root/bin', '/tmp/glimpse')).toEqual({
      command: '/tmp/glimpse',
      args: ['--glimpse-daemon'],
    });
  });

  test('spawns the source daemon entrypoint in normal source runs', () => {
    const command = daemonSpawnCommand('file:///repo/src/ipc/client.ts', '/usr/bin/node');
    expect(command.command).toBe('/usr/bin/node');
    expect(command.args[0]).toEndWith('/repo/src/daemon-main.ts');
  });
});
