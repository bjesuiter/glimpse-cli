import * as v from 'valibot';

export const RequestSchema = v.object({ id: v.string(), method: v.string(), params: v.optional(v.any()) });
export type IpcRequest = v.InferOutput<typeof RequestSchema>;
export type IpcResponse = { id: string; ok: true; result?: unknown } | { id: string; ok: false; error: { code: string; message: string } };
export const ok = (id: string, result?: unknown): IpcResponse => ({ id, ok: true, result });
export const fail = (id: string, code: string, message: string): IpcResponse => ({ id, ok: false, error: { code, message } });
