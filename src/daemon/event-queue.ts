export type WindowEvent = { id: number; type: string; data?: unknown; timestamp: string };

export class EventQueue {
  private events: WindowEvent[] = [];
  private seq = 0;
  constructor(private max = 1000) { this.max = Math.min(Math.max(max, 1), 20_000); }
  push(type: string, data?: unknown) {
    if (type.startsWith('window.') || type.startsWith('glimpse.') || type.startsWith('html.')) type = 'glimpse.error';
    this.events.push({ id: ++this.seq, type, data, timestamp: new Date().toISOString() });
    if (this.events.length > this.max) this.events.shift();
  }
  system(type: string, data?: unknown) { this.events.push({ id: ++this.seq, type, data, timestamp: new Date().toISOString() }); if (this.events.length > this.max) this.events.shift(); }
  peek(type?: string) { return type ? this.events.filter(e => e.type === type) : [...this.events]; }
  read(type?: string): WindowEvent | null { const i = type ? this.events.findIndex(e => e.type === type) : 0; return i < 0 ? null : this.events.splice(i, 1)[0]; }
  get size() { return this.events.length; }
}
