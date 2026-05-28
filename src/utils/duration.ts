export function parseDuration(input?: string): number | undefined {
  if (input == null || input === '') return undefined;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: ${input}`);
  const n = Number(match[1]);
  const unit = match[2] ?? 'ms';
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid duration: ${input}`);
  return unit === 'm' ? n * 60_000 : unit === 's' ? n * 1_000 : n;
}
