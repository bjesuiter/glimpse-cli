declare module 'glimpseui' {
  export function open(html: string, options?: Record<string, unknown>): unknown;
  export function prompt(html: string, options?: Record<string, unknown>): Promise<unknown>;
}
