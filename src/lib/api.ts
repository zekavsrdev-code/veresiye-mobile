import { getRuntimeEnv } from './env';

// Mirrors frontend/src/lib/api.ts so the client contract is identical across web
// and mobile. Differences: no cookie `credentials: 'include'` (RN uses the JWT
// bearer only) and no SSR window injection (base URL comes from ./env).
const BASE_URL = getRuntimeEnv().BACKEND_URL;

// ─── Domain-agnostic interfaces ─────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  member_count: number;
  created_at: string;
}

export interface Permission {
  codename: string;
  module: string;
  description: string;
}

export interface Membership {
  id: string;
  user_id: string;
  username: string;
  email: string;
  first_name: string;
  role: string;
  role_name: string;
  is_owner: boolean;
  can_grant: boolean;
  joined_at: string;
}

// ─── Example app (notes) — replace with your own domain ─────────────────────────

export interface Note {
  id: string;
  tenant: string;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Error types ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: Record<string, string[]> | null;

  constructor(
    status: number,
    code: string,
    detail: string,
    errors: Record<string, string[]> | null = null,
  ) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function getErrorMessage<K extends string>(err: unknown, t: (key: K) => string): string {
  if (!isApiError(err)) {
    return err instanceof Error ? err.message : String(err);
  }
  const lookup = t as unknown as (key: string) => string;
  if (err.status === 0) return lookup('err_network');
  if (err.status === 401) return lookup('err_unauthorized');
  if (err.status === 403) return lookup('err_forbidden');
  if (err.status === 409) return err.message || lookup('err_conflict');
  if (err.status === 429) return lookup('err_rate_limited');
  if (err.status >= 500) return lookup('err_server');
  return err.message;
}

// ─── Internal helpers ───────────────────────────────────────────────────────────

function buildHeaders(token?: string, isJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let code = 'error';
    let detail = `HTTP ${res.status}`;
    let errors: Record<string, string[]> | null = null;
    try {
      const data = await res.json();
      if (data.code) code = data.code;
      if (data.detail) {
        detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      } else if (data.non_field_errors) {
        detail = data.non_field_errors.join(', ');
      } else if (!data.code) {
        const messages: string[] = [];
        for (const key of Object.keys(data)) {
          const val = data[key];
          if (Array.isArray(val)) messages.push(`${key}: ${val.join(', ')}`);
          else if (typeof val === 'string') messages.push(`${key}: ${val}`);
        }
        if (messages.length > 0) detail = messages.join(' | ');
      }
      if (data.errors) errors = data.errors;
    } catch {
      // body wasn't JSON
    }
    throw new ApiError(res.status, code, detail, errors);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ─── API functions ──────────────────────────────────────────────────────────────

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', headers: buildHeaders(token, false) });
  } catch {
    throw new ApiError(0, 'network_error', 'network_error');
  }
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'network_error');
  }
  return handleResponse<T>(res);
}

export async function apiPut<T>(path: string, body: unknown, token?: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers: buildHeaders(token),
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'network_error');
  }
  return handleResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown, token?: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PATCH',
      headers: buildHeaders(token),
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'network_error');
  }
  return handleResponse<T>(res);
}

export async function apiDelete(path: string, token?: string): Promise<void> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { method: 'DELETE', headers: buildHeaders(token, false) });
  } catch {
    throw new ApiError(0, 'network_error', 'network_error');
  }
  return handleResponse<void>(res);
}

// ─── List unwrapper ─────────────────────────────────────────────────────────────
// Paginated endpoints return { results: T[] }, unpaginated return T[] directly.
export function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results;
}

// ─── Background job status (Dramatiq + job_tracker) ─────────────────────────────

export interface FlowRunStatus {
  job_id: string;
  state: string; // RUNNING | COMPLETED | FAILED
  state_name: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
}

export function getFlowRunStatus(jobId: string, token?: string): Promise<FlowRunStatus> {
  return apiGet<FlowRunStatus>(`/flow-runs/${jobId}/`, token);
}
