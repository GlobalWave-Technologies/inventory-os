// Tells the developer when something breaks in a browser. It sends only the kind of problem,
// a short message, the page address without its query, and the shape of the request address
// (ids removed). It never sends what someone typed, tokens, names, products or amounts.
const API_BASE_URL = (import.meta.env["VITE_API_URL"] ?? "").replace(/\/$/, "");

export type Problem = {
  kind: "js_error" | "promise_rejection" | "react_crash" | "api_failed" | "slow_response";
  message?: string;
  api?: string;
  method?: string;
  status?: number;
  ms?: number;
};

const seen = new Set<string>();
let count = 0;

export function reportProblem(problem: Problem) {
  if (typeof window === "undefined" || !API_BASE_URL) return;
  if (navigator.onLine === false) return; // being offline is not a bug
  const key = `${problem.kind}|${problem.api ?? ""}|${(problem.message ?? "").slice(0, 60)}`;
  if (seen.has(key) || count >= 5) return; // the same problem once, and at most 5 per visit
  seen.add(key);
  count += 1;
  try {
    void fetch(`${API_BASE_URL}/client-problems`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
      body: JSON.stringify({
        ...problem,
        ...(problem.message ? { message: problem.message.slice(0, 300) } : {}),
        page: window.location.pathname.slice(0, 120),
      }),
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    /* reporting must never cause a problem of its own */
  }
}

const NOISE = /^(ResizeObserver|Script error)/i;

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    if (!event.message || NOISE.test(event.message)) return;
    reportProblem({ kind: "js_error", message: event.message });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    // Requests that fail are reported once by the request code, so skip those here.
    if ((reason as { name?: string } | null)?.name === "ApiError") return;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (NOISE.test(message)) return;
    reportProblem({ kind: "promise_rejection", message });
  });
}
