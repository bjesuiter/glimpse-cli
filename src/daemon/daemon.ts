import { WindowRegistry } from './window-registry.ts';

const registry = new WindowRegistry();

export async function dispatch(method: string, p: any = {}) {
  switch (method) {
    case 'ping': return { pong: true };
    case 'open': { const w = registry.open(p.html, p); return { windowId: w.id, name: w.name }; }
    case 'set-html': registry.setHtml(p.window, p.html); return { ok: true };
    case 'navigate': registry.setHtml(p.window, `<script>location.href=${JSON.stringify(p.url)}</script>`); return { ok: true };
    case 'send': registry.send(p.window, p.type, p.data); return { ok: true };
    case 'eval': registry.eval(p.window, p.js); return { ok: true };
    case 'read': return { event: registry.resolve(p.window)?.queue.read(p.type) ?? null };
    case 'peek':
    case 'events': return { events: registry.resolve(p.window)?.queue.peek(p.type) ?? [] };
    case 'wait': return wait(p.window, p.type, p.timeout);
    case 'close': p.all ? registry.closeAll(p.force) : registry.close(p.window, p.force); return { ok: true };
    case 'list': return { daemon: { running: true }, windows: registry.list(p.includeClosed) };
    default: throw new Error(`Unknown IPC method: ${method}`);
  }
}

function wait(window: string, type?: string, timeout?: number) {
  return new Promise((resolve, reject) => {
    const deadline = timeout ? setTimeout(() => { clearInterval(iv); reject(new Error('timeout')); }, timeout) : null;
    const iv = setInterval(() => {
      const ev = registry.resolve(window)?.queue.read(type);
      if (ev) { if (deadline) clearTimeout(deadline); clearInterval(iv); resolve({ event: ev }); }
    }, 50);
  });
}
