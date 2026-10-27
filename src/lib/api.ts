type ApiErrorDetail = {
  field?: string;
  message: string;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  details?: ApiErrorDetail[];
};

export class ApiError extends Error {
  status: number;
  details: ApiErrorDetail[];

  constructor(status: number, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const API_BASE_URL = (import.meta.env["VITE_API_URL"] ?? "").replace(/\/$/, "");

// The access token lives only in memory. The refresh token lives in an httpOnly cookie
// set by the server, so no script on the page (including ours) can read it.
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function clearTokens() {
  accessToken = null;
}

// The server rejects cookie-based calls (refresh, logout) without this header,
// because another website cannot add a custom header to a request it triggers.
const CSRF_HEADERS = { "X-Requested-With": "fetch" };

function mapResponseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mapResponseKeys);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
      // A product's "custom" object is keyed by field ids. Those are data, not field names.
      key === "custom" ? entry : mapResponseKeys(entry),
    ]),
  );
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getError(response: Response, payload: unknown): ApiError {
  if (response.status === 429) {
    return new ApiError(429, "Too many attempts. Please wait before trying again.");
  }
  if (response.status === 503) {
    return new ApiError(503, "The service is temporarily unavailable. Please try again shortly.");
  }
  if (response.status >= 500) {
    return new ApiError(
      response.status,
      "The service encountered an error. Please try again shortly.",
    );
  }

  const mapped = mapResponseKeys(payload) as ApiErrorPayload | string | null;
  const message =
    typeof mapped === "string"
      ? mapped
      : (mapped?.message ?? mapped?.error ?? `Request failed (${response.status}).`);
  return new ApiError(
    response.status,
    message,
    typeof mapped === "object" && mapped ? (mapped.details ?? []) : [],
  );
}

async function fetchWithAvailabilityRetry(url: string, init: RequestInit) {
  let response = await fetch(url, init);
  if (response.status === 503) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    response = await fetch(url, init);
  }
  return response;
}

async function doRefresh(): Promise<boolean> {
  const response = await fetchWithAvailabilityRetry(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: CSRF_HEADERS,
    credentials: "include",
  });
  if (!response.ok) {
    if (response.status === 429 || response.status === 503) {
      throw getError(response, await readPayload(response));
    }
    clearTokens();
    return false;
  }

  const result = mapResponseKeys(await readPayload(response)) as { accessToken?: string } | null;
  if (!result?.accessToken) {
    clearTokens();
    return false;
  }
  setAccessToken(result.accessToken);
  return true;
}

// Refresh tokens work once. Two refreshes at the same moment look like token theft to
// the server and sign the user out everywhere. refreshInFlight covers one tab; the Web
// Lock makes other open tabs wait their turn too.
export function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  if (!API_BASE_URL) return Promise.resolve(false);

  const run = () => doRefresh();
  const locked = navigator.locks
    ? navigator.locks.request("stockline-refresh", run)
    : run();

  refreshInFlight = locked.finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(0, "Set VITE_API_URL to the inventory API origin before signing in.");
  }
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const send = () => {
    const headers = new Headers(init.headers);
    headers.set("X-Requested-With", "fetch");
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetchWithAvailabilityRetry(url, { ...init, headers, credentials: "include" });
  };

  let response = await send();
  // A 401 from /auth/* is an answer (wrong password), not an expired session.
  if (response.status === 401 && !path.startsWith("/auth/")) {
    if (await refreshTokens()) response = await send();
    if (response.status === 401) window.dispatchEvent(new Event("stockline:session-expired"));
  }

  const payload = await readPayload(response);
  if (!response.ok) throw getError(response, payload);
  return mapResponseKeys(payload) as T;
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
}
