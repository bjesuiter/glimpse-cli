import { readFileSync } from 'node:fs';

export function parseJson(input: string, label = 'JSON'): unknown {
  try { return JSON.parse(input); } catch (err) { throw new Error(`Invalid ${label}: ${(err as Error).message}`); }
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export async function readDataFile(path: string): Promise<unknown> {
  const text = path === '-' ? await readStdin() : readFileSync(path, 'utf8');
  return parseJson(text, path === '-' ? 'stdin JSON' : `${path} JSON`);
}
