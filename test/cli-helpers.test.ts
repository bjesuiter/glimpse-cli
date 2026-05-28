import { describe, expect, test } from 'bun:test';
import { iframeForUrl } from '../src/cli-helpers.ts';

describe('CLI URL wrapper helpers', () => {
  test('escapes iframe URL attributes', () => {
    const html = iframeForUrl('http://localhost/&quot; onload=&quot;alert(1)');

    expect(html).toContain('src="http://localhost/&amp;quot;%20onload=&amp;quot;alert(1)"');
    expect(html).not.toContain(' onload=');
  });
});
