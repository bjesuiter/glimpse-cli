import { describe, expect, test } from 'bun:test';
import { dispatch } from '../src/daemon/daemon.ts';

describe('daemon wait command', () => {
  test('rejects immediately for missing windows', async () => {
    await expect(dispatch('wait', { window: 'missing-window' })).rejects.toThrow('Window missing-window is not open.');
  });
});
