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

// ─── Ledger (veresiye defteri) ──────────────────────────────────────────────────
// Mirrors backend/ledger/serializers.py exactly. Money fields are decimal STRINGS.

// Cursor-following: apiGet already accepts absolute URLs, so the next page is
// simply apiGet(page.next) — no dedicated pagination helper needed.
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Customer {
  id: string;
  tenant: string;
  name: string;
  phone: string;
  balance: string; // computed server-side, 2dp decimal string; >0 = customer owes shop
  has_dispute: boolean;
  has_overdue: boolean;
  last_transaction_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerTransaction {
  id: string;
  tenant: string;
  customer: string;
  type: 'borc' | 'odeme';
  amount: string;
  note: string;
  due_date: string | null; // YYYY-MM-DD; debts only
  attachments: { id: string; image: string; created_at: string }[];
  created_at: string;
}

export interface AgingBuckets {
  current: string;
  d1_30: string;
  d31_60: string;
  d61_90: string;
  d90_plus: string;
}

export interface AgingReport {
  buckets: AgingBuckets;
  total_overdue: string;
  customers: {
    id: string;
    name: string;
    overdue_total: string;
    buckets: AgingBuckets;
  }[];
}

export interface PeriodSums {
  borc: string;
  odeme: string;
}

export interface TenantStats {
  periods: { today: PeriodSums; week: PeriodSums; month: PeriodSums };
  customer_count: number;
  debtor_count: number;
  total_receivable: string;
  total_overdue: string;
}

export interface SystemConfig {
  deployment_mode: 'saas' | 'onpremise';
  is_saas: boolean;
  is_onpremise: boolean;
  allow_public_registration: boolean;
}

export interface CustomerTotals {
  total_receivable: string;
}

export interface StatementResponseInfo {
  decision: 'approve' | 'dispute';
  note: string;
  created_at: string;
}

export interface StatementLinkInfo {
  id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  is_active: boolean;
  response: StatementResponseInfo | null;
}

export interface SendStatementResp {
  job_id: string;
}

export interface RevokeResp {
  revoked: number;
}

export interface MyPermissions {
  is_owner: boolean;
  can_grant: boolean;
  codenames: string[];
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

// ─── Global 401 hook ────────────────────────────────────────────────────────────
// A mid-session 401 means the stored token died (expiry, server-side revoke).
// AuthProvider registers a handler that clears the session and lands on /login;
// /auth/* is exempt (a login 401 is "wrong password", not "session expired").

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

// ─── Session tokens + silent refresh ────────────────────────────────────────────
// AuthProvider feeds the CURRENT access+refresh pair here; on a 401 the request
// core silently rotates the refresh token (single-flight) and retries once. The
// refreshed pair is pushed back to AuthProvider via the handler so state and
// SecureStore stay in sync. Backend returns the refresh token in the BODY only
// for requests carrying X-Client-Platform: mobile (RN has no cookie jar).

let sessionAccess: string | null = null;
let sessionRefresh: string | null = null;
let onTokensRefreshed: ((tokens: { access: string; refresh: string }) => void) | null = null;

export function setSessionTokens(access: string | null, refresh: string | null): void {
  sessionAccess = access;
  sessionRefresh = refresh;
}

export function setTokensRefreshedHandler(
  handler: ((tokens: { access: string; refresh: string }) => void) | null,
): void {
  onTokensRefreshed = handler;
}

// Single-flight: many parallel 401s trigger ONE rotation; the rest await it.
// (Rotation blacklists the old token — a second concurrent rotate would 401.)
let refreshInFlight: Promise<string | null> | null = null;

function refreshSession(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const current = sessionRefresh;
      if (!current) return null;
      try {
        const res = await fetch(apiUrl('/auth/refresh/'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
          body: JSON.stringify({ refresh: current }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { access: string; refresh?: string };
        sessionAccess = data.access;
        sessionRefresh = data.refresh ?? current;
        onTokensRefreshed?.({ access: sessionAccess, refresh: sessionRefresh });
        return sessionAccess;
      } catch {
        return null; // offline — the caller surfaces the original 401
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
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

/** Resolves a relative API path to an absolute URL — used where a plain fetch
 * (e.g. an authenticated file download) needs the same base URL as apiGet/etc. */
export function apiUrl(path: string): string {
  return path.startsWith('http') ? path : `${BASE_URL}${path}`;
}

function buildHeaders(token?: string, isJson = true): Record<string, string> {
  // The platform header tells the backend to carry refresh tokens in the BODY
  // (web stays httpOnly-cookie-only) — see core/auth_views._is_mobile_client.
  const headers: Record<string, string> = { 'X-Client-Platform': 'mobile' };
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

// ─── Request core (auth-aware, refresh-on-401) ───────────────────────────────────
// Every helper funnels through here. On a 401 for a non-/auth/ request it silently
// rotates the refresh token (single-flight) and retries ONCE with the new access
// token; if refresh fails it fires onUnauthorized (→ login) and rethrows the 401.
// `token` args are kept for call-site compatibility but the live session access
// token wins, so a retry uses the freshly-rotated one.

interface RequestOpts {
  method: string;
  token?: string;
  json?: unknown; // JSON body
  form?: FormData; // multipart body (skips Content-Type)
}

async function request<T>(path: string, opts: RequestOpts, isRetry = false): Promise<T> {
  const url = apiUrl(path);
  const bearer = sessionAccess ?? opts.token;
  const headers = buildHeaders(bearer, opts.form === undefined && opts.json !== undefined);
  const body = opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined);

  let res: Response;
  try {
    res = await fetch(url, { method: opts.method, headers, body });
  } catch {
    throw new ApiError(0, 'network_error', 'network_error');
  }

  // Mid-session 401 on a protected call → try a silent refresh + one retry. The
  // /auth/* endpoints are exempt (a login/refresh 401 is terminal, not renewable).
  if (res.status === 401 && !isRetry && !path.includes('/auth/')) {
    const newAccess = await refreshSession();
    if (newAccess) {
      return request<T>(path, { ...opts, token: newAccess }, true);
    }
    onUnauthorized?.(); // refresh failed → session is dead
  }
  return handleResponse<T>(res);
}

// ─── API functions ──────────────────────────────────────────────────────────────

export function apiGet<T>(path: string, token?: string): Promise<T> {
  return request<T>(path, { method: 'GET', token });
}

export function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  return request<T>(path, { method: 'POST', token, json: body });
}

export function apiPut<T>(path: string, body: unknown, token?: string): Promise<T> {
  return request<T>(path, { method: 'PUT', token, json: body });
}

export function apiPatch<T>(path: string, body: unknown, token?: string): Promise<T> {
  return request<T>(path, { method: 'PATCH', token, json: body });
}

export function apiDelete(path: string, token?: string, body?: unknown): Promise<void> {
  return request<void>(path, { method: 'DELETE', token, json: body });
}

// Multipart upload: fetch sets the multipart boundary Content-Type itself, so
// `form` is passed through and buildHeaders skips the JSON content type.
export function apiUpload<T>(path: string, form: FormData, token?: string): Promise<T> {
  return request<T>(path, { method: 'POST', token, form });
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
