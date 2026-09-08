const ghs = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 2,
});

/** Format a number as Ghana cedis, e.g. GH₵1,240.00 */
export function money(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  try {
    return ghs.format(n).replace("₵", "GH₵").replace("GHGH₵", "GH₵");
  } catch {
    return `GH₵${n.toFixed(2)}`;
  }
}

export function compactMoney(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  if (Math.abs(n) >= 1_000_000) return `GH₵${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `GH₵${(n / 1000).toFixed(1)}k`;
  return money(n);
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function shortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
