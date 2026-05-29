import { watch, FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';

export type HtmlWatchTarget = {
  setHtml(html: string): void;
  onReload?(): void;
  onError?(error: unknown): void;
};

export function watchHtmlFile(path: string, target: HtmlWatchTarget): FSWatcher {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reloading = false;
  let pending = false;

  const reload = async () => {
    if (reloading) { pending = true; return; }
    reloading = true;
    try {
      const html = await readFile(path, 'utf8');
      target.setHtml(html);
      target.onReload?.();
    } catch (error) {
      target.onError?.(error);
    } finally {
      reloading = false;
      if (pending) { pending = false; void reload(); }
    }
  };

  const watcher = watch(path, { persistent: false }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void reload(), 75);
  });

  watcher.on('error', error => target.onError?.(error));
  return watcher;
}
