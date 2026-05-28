import * as glimpse from 'glimpseui';

export type RuntimeWindow = {
  on(event: 'ready'|'message'|'closed'|'error', cb: (...args: any[]) => void): void;
  once(event: 'ready'|'message'|'closed'|'error', cb: (...args: any[]) => void): void;
  setHTML(html: string): void;
  send(js: string): void;
  close(): void;
};

export function withBridge(html: string, csp?: string): string {
  // Glimpse injects window.glimpse at document start in the native host.
  // Do not polyfill/overwrite it here, or page-to-CLI messages stop working.
  const meta = csp ? `<meta http-equiv="Content-Security-Policy" content="${csp.replaceAll('"','&quot;')}">` : '';
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => `${m}${meta}`) : `${meta}${html}`;
}

export function openWindow(html: string, options: Record<string, unknown> = {}): RuntimeWindow {
  return glimpse.open(html, options) as RuntimeWindow;
}

export async function promptWindow(html: string, options: Record<string, unknown> = {}) {
  return glimpse.prompt(html, options);
}
