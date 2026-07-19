import { config } from "./config";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: { total: number; page: number; pageSize: number; totalPages: number };
  error?: { code: string; message: string; details?: unknown };
  statusCode?: number;
}

// ── In-memory auth state (access token never touches localStorage — Blueprint §5) ──
let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setRefreshHandler = (fn: (() => Promise<string | null>) | null) => { refreshHandler = fn; };

async function parse<T>(res: Response): Promise<{ data: T; meta?: Envelope<T>["meta"] }> {
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.success) {
    const err = body?.error;
    throw new ApiError(err?.code ?? "ERROR", err?.message ?? res.statusText, res.status, err?.details);
  }
  return { data: body.data as T, meta: body.meta };
}

// Reads should fail fast; writes need real headroom. A booking runs a multi-step
// transaction (lock → availability → per-night pricing → create → charges), and on
// a cold serverless start against the remote DB that easily passes 8s. The old flat
// 8s aborted mid-write — the server still committed, so the guest got an "error" for
// a booking that actually succeeded, then retried and double-booked.
const READ_TIMEOUT = 15000;
const WRITE_TIMEOUT = 30000;
const isWrite = (m?: string) => !!m && m.toUpperCase() !== "GET" && m.toUpperCase() !== "HEAD";

async function timeoutFetch(url: string, init: RequestInit, ms?: number): Promise<Response> {
  const budget = ms ?? (isWrite(init.method) ? WRITE_TIMEOUT : READ_TIMEOUT);
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), budget);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    // A timeout on a WRITE is ambiguous — the server may well have completed it.
    // Say so, so the user checks before retrying rather than creating a duplicate.
    if ((e as Error).name === "AbortError") {
      throw new ApiError(
        "TIMEOUT",
        isWrite(init.method)
          ? "The server took too long to respond. Your request may still have gone through — please check before trying again."
          : "The server took too long to respond. Please try again.",
        0,
      );
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}

/** Public (unauthenticated) request against the public API base. */
export async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!config.publicApiUrl) throw new ApiError("NO_API", "Public API not configured", 0);
  const res = await timeoutFetch(`${config.publicApiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  return (await parse<T>(res)).data;
}

/** Authenticated request against the internal API base, with one refresh retry on 401. */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  _retry = true,
): Promise<{ data: T; meta?: Envelope<T>["meta"] }> {
  if (!config.apiUrl) throw new ApiError("NO_API", "API not configured", 0);
  const res = await timeoutFetch(`${config.apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && _retry && refreshHandler) {
    const fresh = await refreshHandler();
    if (fresh) return apiRequest<T>(path, init, false);
  }
  return parse<T>(res);
}

export const api = {
  get: <T>(p: string) => apiRequest<T>(p).then((r) => r),
  post: <T>(p: string, body?: unknown) => apiRequest<T>(p, { method: "POST", body: JSON.stringify(body ?? {}) }).then((r) => r.data),
  patch: <T>(p: string, body?: unknown) => apiRequest<T>(p, { method: "PATCH", body: JSON.stringify(body ?? {}) }).then((r) => r.data),
  del: <T>(p: string) => apiRequest<T>(p, { method: "DELETE" }).then((r) => r.data),
};
