import net from 'node:net';
import { unlinkSync, writeFileSync } from 'node:fs';
import * as v from 'valibot';
import { RequestSchema, ok, fail } from './protocol.ts';
import { socketPath, statePath } from '../platform/paths.ts';

export function serve(dispatch: (method: string, params: any) => Promise<unknown>|unknown) {
  try { unlinkSync(socketPath()); } catch {}
  const server = net.createServer(sock => {
    let buf = '';
    sock.on('data', async chunk => {
      buf += chunk.toString();
      for (;;) {
        const i = buf.indexOf('\n'); if (i < 0) break;
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        let id = 'unknown';
        try {
          const req = v.parse(RequestSchema, JSON.parse(line)); id = req.id;
          sock.write(JSON.stringify(ok(id, await dispatch(req.method, req.params))) + '\n');
        } catch (err) { sock.write(JSON.stringify(fail(id, 'command_failed', (err as Error).message)) + '\n'); }
      }
    });
  });
  server.listen(socketPath(), () => writeFileSync(statePath(), JSON.stringify({ pid: process.pid, socketPath: socketPath(), startedAt: new Date().toISOString() })));
  return server;
}
