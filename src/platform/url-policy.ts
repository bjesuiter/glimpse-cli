import { lookup } from 'node:dns/promises';
import net from 'node:net';

export type UrlTrust = { trusted: boolean; remote: boolean; reason: string };

export function isLoopbackAddress(address: string): boolean {
  if (net.isIPv4(address)) return address === '127.0.0.1' || address.startsWith('127.');
  if (net.isIPv6(address)) return address === '::1' || address === '0:0:0:0:0:0:0:1';
  return false;
}

export async function classifyUrl(raw: string): Promise<UrlTrust> {
  let url: URL;
  try { url = new URL(raw); } catch { return { trusted: false, remote: true, reason: 'invalid_url' }; }
  if (url.protocol === 'file:') return { trusted: true, remote: false, reason: 'file' };
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { trusted: false, remote: true, reason: 'unsupported_protocol' };
  const host = url.hostname;
  if (host === 'localhost') return { trusted: true, remote: false, reason: 'localhost' };
  if (isLoopbackAddress(host)) return { trusted: true, remote: false, reason: 'loopback' };
  if (host.endsWith('.localhost')) {
    const answers = await lookup(host, { all: true });
    const ok = answers.length > 0 && answers.every(a => isLoopbackAddress(a.address));
    return { trusted: ok, remote: !ok, reason: ok ? 'localhost_subdomain' : 'localhost_subdomain_non_loopback' };
  }
  return { trusted: false, remote: true, reason: 'remote' };
}

export async function assertUrlAllowed(raw: string, allowRemote?: boolean) {
  const trust = await classifyUrl(raw);
  if (!trust.trusted && !allowRemote) throw new Error(`Remote URL blocked: ${raw}`);
  return trust;
}
