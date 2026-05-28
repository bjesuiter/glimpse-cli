import { describe, expect, test } from 'bun:test';
import { parseDuration } from '../src/utils/duration.ts';
import { EventQueue } from '../src/daemon/event-queue.ts';
import { isLoopbackAddress } from '../src/platform/url-policy.ts';

describe('duration', () => {
  test('parses ms/s/m suffixes', () => {
    expect(parseDuration('250')).toBe(250);
    expect(parseDuration('250ms')).toBe(250);
    expect(parseDuration('2s')).toBe(2000);
    expect(parseDuration('1.5m')).toBe(90000);
  });
  test('rejects invalid values', () => expect(() => parseDuration('1h')).toThrow());
});

describe('event queue', () => {
  test('filtered read preserves non-matching events', () => {
    const q = new EventQueue(); q.push('a', 1); q.push('b', 2);
    expect(q.read('b')?.data).toBe(2);
    expect(q.read()?.type).toBe('a');
  });
  test('peek does not consume', () => { const q = new EventQueue(); q.push('x'); expect(q.peek()).toHaveLength(1); expect(q.peek()).toHaveLength(1); });
  test('system prefixes are rejected for page events', () => { const q = new EventQueue(); q.push('window.ready'); expect(q.read()?.type).toBe('glimpse.error'); });
});

describe('url policy helpers', () => {
  test('detects loopback', () => { expect(isLoopbackAddress('127.2.3.4')).toBe(true); expect(isLoopbackAddress('::1')).toBe(true); expect(isLoopbackAddress('8.8.8.8')).toBe(false); });
});
