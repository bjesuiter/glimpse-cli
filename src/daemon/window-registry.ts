import { randomUUID } from 'node:crypto';
import type { FSWatcher } from 'node:fs';
import { EventQueue } from './event-queue.ts';
import { watchHtmlFile } from './watchers.ts';
import { openWindow, RuntimeWindow } from '../runtime/glimpse-adapter.ts';

export type WindowRecord = { id: string; name?: string; state: 'open'|'closed'; source: any; bridge: boolean; security: any; queue: EventQueue; win?: RuntimeWindow; watcher?: FSWatcher; closedAt?: number; expiresAt?: number };

export class WindowRegistry {
  private windows = new Map<string, WindowRecord>();
  resolve(ref: string) { return this.windows.get(ref) ?? [...this.windows.values()].find(w => w.name === ref && w.state === 'open'); }
  list(includeClosed = false) { const now = Date.now(); return [...this.windows.values()].filter(w => w.state === 'open' || (includeClosed && (w.expiresAt ?? 0) > now)).map(w => ({ windowId: w.id, name: w.name, state: w.state, eventQueueSize: w.queue.size, source: w.source, bridge: w.bridge, security: w.security, expiresAt: w.expiresAt ? new Date(w.expiresAt).toISOString() : undefined })); }
  open(html: string, opts: { name?: string; replace?: boolean; options?: any; source?: any; bridge?: boolean; security?: any; watchPath?: string } = {}) {
    if (opts.name) {
      const old = this.resolve(opts.name);
      if (old && !opts.replace) throw new Error(`Window name is already in use: ${opts.name}`);
      if (old) this.close(old.id, true);
    }
    const rec: WindowRecord = { id: `win_${randomUUID()}`, name: opts.name, state: 'open', source: opts.source, bridge: opts.bridge ?? true, security: opts.security, queue: new EventQueue(), win: openWindow(html, opts.options ?? {}) };
    this.windows.set(rec.id, rec);
    rec.win?.once('ready', () => rec.queue.system('window.ready'));
    rec.win?.on('message', data => rec.queue.push(typeof data === 'object' && data && 'type' in data ? String((data as any).type) : 'json', data));
    rec.win?.once('closed', () => this.markClosed(rec));
    rec.win?.on('error', err => rec.queue.system('glimpse.error', { message: String(err?.message ?? err) }));
    if (opts.watchPath) {
      rec.watcher = watchHtmlFile(opts.watchPath, {
        setHtml: html => rec.win?.setHTML(html),
        onReload: () => rec.queue.system('html.reloaded'),
        onError: error => rec.queue.system('glimpse.error', { message: String((error as Error)?.message ?? error) }),
      });
    }
    return rec;
  }
  setHtml(ref: string, html: string) { const w = this.must(ref); w.win!.setHTML(html); w.source = { kind: 'html' }; w.queue.system('html.reloaded'); return w; }
  eval(ref: string, js: string) { const w = this.must(ref); w.win!.send(`Promise.resolve(${js}).then(r=>window.glimpse?.send({type:'eval.result',data:r})).catch(e=>window.glimpse?.send({type:'glimpse.error',data:{message:String(e)}}))`); }
  send(ref: string, type: string, data: unknown) { const w = this.must(ref); if (!w.bridge) throw new Error('Window has no bridge'); w.win!.send(`window.dispatchEvent(new CustomEvent('glimpse-message',{detail:${JSON.stringify({ type, data })}}))`); }
  close(ref: string, force = false) { const w = this.must(ref); w.watcher?.close(); if (force) { w.win?.close(); this.windows.delete(w.id); return; } w.win?.close(); this.markClosed(w); }
  closeAll(force = false) { for (const w of [...this.windows.values()].filter(w => w.state === 'open')) this.close(w.id, force); }
  requireOpen(ref: string) { const w = this.resolve(ref); if (!w || w.state !== 'open') throw new Error(`Window ${ref} is not open.`); return w; }
  private must(ref: string) { return this.requireOpen(ref); }
  private markClosed(w: WindowRecord) { if (w.state === 'closed') return; w.watcher?.close(); w.state = 'closed'; w.queue.system('window.closed'); w.closedAt = Date.now(); w.expiresAt = w.closedAt + 30_000; w.name = undefined; setTimeout(() => this.windows.delete(w.id), 30_000).unref?.(); }
}
