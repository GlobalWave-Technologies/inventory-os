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
const REFRESH_TOKEN_KEY = "stockline-refresh-token";

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function saveTokens(nextAccessToken: string, nextRefreshToken: string) {
  accessToken = nextAccessToken;
  sessionStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
}

export function clearTokens() {
  accessToken = null;
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasRefreshToken() {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY) !== null;
}

function mapResponseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mapResponseKeys);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
      mapResponseKeys(entry),
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

async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    try {
      const response = await fetchWithAvailabilityRetry(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        if (response.status === 429 || response.status === 503) {
          throw getError(response, await readPayload(response));
        }
        clearTokens();
        return false;
      }

      const result = mapResponseKeys(await readPayload(response)) as {
        accessToken?: string;
        refreshToken?: string;
      } | null;
      if (!result?.accessToken || !result.refreshToken) {
        clearTokens();
        return false;
      }

      saveTokens(result.accessToken, result.refreshToken);
      return true;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 429 || error.status === 503)) throw error;
      throw error;
    }
  })().finally(() => {
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
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetchWithAvailabilityRetry(url, { ...init, headers, credentials: "include" });
  };

  let response = await send();
  if (response.status === 401) {
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
