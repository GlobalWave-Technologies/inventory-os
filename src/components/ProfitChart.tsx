import { useId } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactMoney, profitOrLoss } from "@/lib/format";
import type { SalesRow } from "@/lib/reports";

type Day = { day: string; profit: number; text: string };

const GREEN = "var(--aurora-a)";
const RED = "var(--rose)";
const NEUTRAL = "var(--fog)";
const DATE = /^\d{4}-\d{2}-\d{2}/;

const dayLabel = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const axisMoney = (value: number) => compactMoney(value).replace(/\.00$/, "");
const toneOf = (value: number) => (value > 0 ? GREEN : value < 0 ? RED : NEUTRAL);

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

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Day }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const result = profitOrLoss(point.text);
  return (
    <div className="rounded-xl border border-hair bg-panel p-2.5 text-xs shadow-lg">
      <p className="text-fog">{dayLabel(point.day)}</p>
      <p className="num mt-0.5 font-semibold text-strong">
        {result.label} {result.amount}
      </p>
    </div>
  );
}

export function ProfitChart({ from, to, rows, truncated }: { from: string; to: string; rows: SalesRow[]; truncated: boolean }) {
  const gradientId = `profit-line-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (rows.length === 0) return null;
  const days = truncated ? null : fillDays(from, to, rows);
  if (!days) {
    return <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Choose a shorter date range to see the graph.</p>;
  }

  const values = days.map((d) => d.profit);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // The line only needs two colours when it crosses GH₵0, and the gradient switches colour at that height.
  const zero = max / (max - min);
  const stroke = max > 0 && min < 0 ? `url(#${gradientId})` : toneOf(max > 0 ? max : min);
  const ticks = axisTicks(min, max);
  const point = (radius: number) =>
    function Point(props: unknown) {
      const { cx, cy, payload } = props as { cx: number; cy: number; payload: Day };
      return <circle key={payload.day} cx={cx} cy={cy} r={radius} fill={toneOf(payload.profit)} stroke="var(--panel)" strokeWidth={2} />;
    };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-mono">Profit or loss by day</p>
        <div className="flex items-center gap-3 text-xs text-fog">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: GREEN }} />
            Profit, above GH₵0
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: RED }} />
            Loss, below GH₵0
          </span>
        </div>
      </div>
      <div className="mt-3 h-64" role="img" aria-label={`Line graph of profit or loss for each day from ${from} to ${to}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset={zero} style={{ stopColor: GREEN }} />
                <stop offset={zero} style={{ stopColor: RED }} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--hair)" />
            <XAxis
              dataKey="day"
              tickFormatter={dayLabel}
              minTickGap={32}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--fog)", fontSize: 12 }}
            />
            <YAxis
              width={72}
              domain={[ticks[0] ?? 0, ticks[ticks.length - 1] ?? 0]}
              ticks={ticks}
              tickFormatter={axisMoney}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--fog)", fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="var(--fog)" strokeDasharray="4 4" />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--fog)" }} />
            <Line
              type="linear"
              dataKey="profit"
              stroke={stroke}
              strokeWidth={2}
              isAnimationActive={false}
              dot={days.length > 31 ? false : point(4)}
              activeDot={point(6)}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
