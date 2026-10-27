import { ApiError } from "./api";

/**
 * Turns an API error into one readable line.
 * Validation errors name the field ("name is required"); other errors carry the server's own text.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const first = error.details[0];
  if (first?.field) return `${first.field} ${first.message}`;
  return error.message || fallback;
}
