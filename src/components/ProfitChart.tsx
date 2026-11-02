import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { compactMoney, profitOrLoss } from "@/lib/format";
import type { SalesRow } from "@/lib/reports";

type Day = { day: string; profit: number; text: string };

const GREEN = "var(--aurora-a)";
const RED = "var(--rose)";
const DATE = /^\d{4}-\d{2}-\d{2}/;
const HEIGHT = 260;
const PAD = { top: 14, right: 14, bottom: 26, left: 58 };
const WAVE_POINTS = 48;
const MORPH_MS = 1100;

const dayLabel = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const axisMoney = (value: number) => compactMoney(value).replace(/\.00$/, "");
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const at = (list: number[], i: number) => list[i] ?? 0;

/** Round axis values that always include GH₵0. */
function axisTicks(min: number, max: number): number[] {
  const low = Math.min(min, 0);
  const high = Math.max(max, 0);
  if (low === high) return [0, 1];
  const rough = (high - low) / 4;
  const scale = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((n) => n * scale >= rough) ?? 10) * scale;
  const ticks: number[] = [];
  for (let n = Math.floor(low / step); n <= Math.ceil(high / step); n += 1) ticks.push(n * step);
  return ticks;
}

/** One entry for every day in the range, with GH₵0 for days without sales. Null if a row has no readable date. */
function fillDays(from: string, to: string, rows: SalesRow[]): Day[] | null {
  const profits = new Map<string, string>();
  for (const row of rows) {
    const day = String(row.key ?? row.label).match(DATE)?.[0];
    if (!day) return null;
    profits.set(day, row.profit);
  }
  const days: Day[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= end; time += 86_400_000) {
    const day = new Date(time).toISOString().slice(0, 10);
    const text = profits.get(day) ?? "0.00";
    days.push({ day, profit: Number(text), text });
  }
  return days;
}

/** Smooth line through the points that never overshoots, so it cannot cross GH₵0 by accident. */
function smoothPath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return "";
  if (n === 1) return `M${at(xs, 0).toFixed(1)},${at(ys, 0).toFixed(1)}`;
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = at(xs, i + 1) - at(xs, i) || 1;
    slope.push((at(ys, i + 1) - at(ys, i)) / dx);
  }
  const tangent: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (i === 0) tangent.push(at(slope, 0));
    else if (i === n - 1) tangent.push(at(slope, n - 2));
    else {
      const a = at(slope, i - 1);
      const b = at(slope, i);
      tangent.push(a * b <= 0 ? 0 : (2 * a * b) / (a + b));
    }
  }
  let d = `M${at(xs, 0).toFixed(1)},${at(ys, 0).toFixed(1)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const x0 = at(xs, i);
    const x1 = at(xs, i + 1);
    const third = (x1 - x0) / 3;
    d += `C${(x0 + third).toFixed(1)},${(at(ys, i) + at(tangent, i) * third).toFixed(1)} ${(x1 - third).toFixed(1)},${(at(ys, i + 1) - at(tangent, i + 1) * third).toFixed(1)} ${x1.toFixed(1)},${at(ys, i + 1).toFixed(1)}`;
  }
  return d;
}

/** The moving line shown while the figures are still on their way. */
const wave = (f: number, t: number, lo: number, hi: number) =>
  lo + (hi - lo) * (0.5 + 0.26 * Math.sin(f * 6 + t * 0.0017) + 0.13 * Math.sin(f * 13 - t * 0.0026) + 0.06 * Math.sin(f * 27 + t * 0.004));

export function ProfitChart({
  from,
  to,
  rows,
  truncated,
  loading,
}: {
  from: string;
  to: string;
  rows: SalesRow[] | undefined;
  truncated: boolean;
  loading: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [mix, setMix] = useState(0); // 0 = moving line, 1 = real figures
  const [clock, setClock] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const reduce = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const days = useMemo(() => (loading || !rows || truncated ? null : fillDays(from, to, rows)), [loading, rows, truncated, from, to]);
  const ready = days !== null && days.length > 0;
  const unreadable = !loading && rows !== undefined && (truncated || fillDays(from, to, rows) === null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth || 320);
    const watcher = new ResizeObserver(() => setWidth(el.clientWidth || 320));
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);

  // One animation loop. It runs while waiting and during the morph, then stops so it costs nothing at rest.
  useEffect(() => {
    if (reduce) {
      setMix(ready ? 1 : 0);
      setClock(1500);
      return;
    }
    let frame = 0;
    let readyAt = 0;
    const loop = (t: number) => {
      if (ready && readyAt === 0) readyAt = t;
      const p = ready ? Math.min(1, (t - readyAt) / MORPH_MS) : 0;
      setMix(1 - (1 - p) ** 3);
      setClock(t);
      if (!ready || p < 1) frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [ready, reduce]);

  if (unreadable) {
    return <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Choose a shorter date range to see the graph.</p>;
  }
  if (!loading && rows && rows.length === 0) return null;

  const count = days ? days.length : WAVE_POINTS;
  const values = days ? days.map((d) => d.profit) : [];
  const ticks = days ? axisTicks(Math.min(...values), Math.max(...values)) : [-1, 0, 1];
  const lo = ticks[0] ?? -1;
  const hi = ticks[ticks.length - 1] ?? 1;
  const plotW = Math.max(60, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (count === 1 ? plotW / 2 : (i / (count - 1)) * plotW);
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo || 1)) * plotH;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const f = count === 1 ? 0.5 : i / (count - 1);
    const w = wave(f, clock, lo, hi);
    const real = days ? (days[i]?.profit ?? 0) : w;
    xs.push(x(i));
    ys.push(y(w + (real - w) * mix));
  }
  const line = smoothPath(xs, ys);
  const zeroY = y(0);
  const area = `${line}L${at(xs, count - 1).toFixed(1)},${zeroY.toFixed(1)}L${at(xs, 0).toFixed(1)},${zeroY.toFixed(1)}Z`;
  const zeroAt = clamp((zeroY - PAD.top) / plotH, 0, 1);

  const pick = (clientX: number, target: Element) => {
    if (!days) return;
    const rect = target.getBoundingClientRect();
    const f = (clientX - rect.left - PAD.left) / plotW;
    setActive(clamp(Math.round(f * (count - 1)), 0, count - 1));
  };
  const onKey = (e: KeyboardEvent) => {
    if (!days) return;
    if (e.key === "ArrowLeft") setActive((a) => clamp((a ?? count) - 1, 0, count - 1));
    else if (e.key === "ArrowRight") setActive((a) => clamp((a ?? -1) + 1, 0, count - 1));
    else if (e.key === "Escape") setActive(null);
  };

  const point = active !== null && days ? days[active] : undefined;
  const result = point ? profitOrLoss(point.text) : null;
  const labelCount = width < 420 ? 3 : 5;
  const labelIdx = days && count > 1 ? Array.from({ length: labelCount }, (_, k) => Math.round((k / (labelCount - 1)) * (count - 1))) : days ? [0] : [];
  const showLive = mix < 1;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-mono flex items-center gap-2">
          Profit or loss by day
          {showLive && <span className="inline-block size-1.5 animate-pulse rounded-full" style={{ background: GREEN }} />}
        </p>
        <div className="flex items-center gap-3 text-xs text-fog">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: GREEN }} />
            Profit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: RED }} />
            Loss
          </span>
        </div>
      </div>
      <div ref={box} className="relative mt-3 select-none" style={{ height: HEIGHT }}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Line graph of profit or loss for each day from ${from} to ${to}.`}
          tabIndex={ready ? 0 : -1}
          className="block touch-pan-y outline-none"
          onPointerDown={(e: PointerEvent<SVGSVGElement>) => pick(e.clientX, e.currentTarget)}
          onPointerMove={(e: PointerEvent<SVGSVGElement>) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={(e: PointerEvent<SVGSVGElement>) => {
            if (e.pointerType === "mouse") setActive(null);
          }}
          onKeyDown={onKey}
        >
          <defs>
            <linearGradient id={`s${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1={PAD.top} x2="0" y2={PAD.top + plotH}>
              <stop offset={zeroAt} style={{ stopColor: GREEN }} />
              <stop offset={zeroAt} style={{ stopColor: RED }} />
            </linearGradient>
            <linearGradient id={`f${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1={PAD.top} x2="0" y2={PAD.top + plotH}>
              <stop offset={zeroAt} style={{ stopColor: GREEN, stopOpacity: 0.28 }} />
              <stop offset={zeroAt} style={{ stopColor: RED, stopOpacity: 0.28 }} />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick} style={{ opacity: 0.35 + 0.65 * mix }}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(tick)} y2={y(tick)} stroke="var(--hair)" strokeDasharray={tick === 0 ? "4 4" : undefined} />
              {ready && (
                <text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" style={{ fill: "var(--fog)", fontSize: 12, opacity: mix }}>
                  {axisMoney(tick)}
                </text>
              )}
            </g>
          ))}

          {/* While waiting: a soft moving line. When the figures arrive it settles into them. */}
          <path d={area} fill={`url(#f${uid})`} style={{ opacity: mix }} />
          <path d={area} fill={GREEN} style={{ opacity: 0.1 * (1 - mix) }} />
          <path d={line} fill="none" stroke={`url(#s${uid})`} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" style={{ opacity: mix }} />
          <path d={line} fill="none" stroke={GREEN} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" style={{ opacity: 1 - mix }} />

          {days &&
            mix > 0.9 &&
            labelIdx.map((i, k) => (
              <text
                key={i}
                x={x(i)}
                y={HEIGHT - 6}
                textAnchor={k === 0 && labelIdx.length > 1 ? "start" : k === labelIdx.length - 1 && labelIdx.length > 1 ? "end" : "middle"}
                style={{ fill: "var(--fog)", fontSize: 12 }}
              >
                {dayLabel(days[i]?.day ?? from)}
              </text>
            ))}

          {point && active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--fog)" strokeOpacity={0.6} />
              <circle cx={x(active)} cy={y(point.profit)} r={6} fill={point.profit < 0 ? RED : GREEN} stroke="var(--panel)" strokeWidth={2.5} />
            </g>
          )}
        </svg>

        {showLive && !ready && <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 animate-pulse text-center text-xs text-fog">Reading live figures…</p>}

        {point && result && active !== null && (
          <div
            className="pointer-events-none absolute rounded-xl border border-hair bg-panel p-2.5 text-xs shadow-lg"
            style={{ top: 0, left: clamp(x(active), 70, Math.max(70, width - 70)), transform: "translateX(-50%)" }}
          >
            <p className="text-fog">{dayLabel(point.day)}</p>
            <p className={`num mt-0.5 font-semibold ${result.tone}`}>
              {result.label} {result.amount}
            </p>
          </div>
        )}
      </div>
      {ready && <p className="mt-1 text-xs text-fog/60">Touch or hover the line to see a day.</p>}
    </div>
  );
}
