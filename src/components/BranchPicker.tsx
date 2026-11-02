import { Check, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

type Branch = { id: number; name: string };

const SHOW = 100;
const CHIPS = 6;

/** Pick any number of branches from a list that can be very long: search, scroll, tick. */
export function BranchPicker({
  branches,
  value,
  onChange,
}: {
  branches: Branch[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const chosen = useMemo(() => new Set(value), [value]);
  const names = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? branches.filter((b) => b.name.toLowerCase().includes(q)) : branches;
  }, [branches, search]);
  const shown = matches.slice(0, SHOW);

  const toggle = (id: number) => onChange(chosen.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  const selectShown = () => onChange([...new Set([...value, ...shown.map((b) => b.id)])]);

  return (
    <div className="rounded-2xl border border-hair bg-panel/40 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 && <p className="text-sm text-fog/70">No branch chosen yet.</p>}
        {value.slice(0, CHIPS).map((id) => (
          <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-hair bg-panel px-2.5 py-1 text-xs text-strong">
            <span className="truncate">{names.get(id) ?? `#${id}`}</span>
            <button type="button" aria-label={`Remove ${names.get(id) ?? id}`} className="text-fog hover:text-strong" onClick={() => toggle(id)}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        {value.length > CHIPS && <span className="text-xs text-fog/70">+{value.length - CHIPS} more</span>}
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog/60" />
        <input
          className="field pl-9"
          type="search"
          placeholder={`Search ${branches.length} branches`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-hair">
        {shown.length === 0 && <p className="p-3 text-sm text-fog/70">No branch matches that.</p>}
        {shown.map((branch) => {
          const on = chosen.has(branch.id);
          return (
            <button
              key={branch.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(branch.id)}
              className="flex w-full items-center gap-3 border-b border-hair/60 px-3 py-2.5 text-left text-sm text-strong last:border-b-0 hover:bg-panel/70"
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${on ? "border-aurora-a bg-aurora-a" : "border-fog/50"}`}
              >
                {on && <Check className="size-3.5" style={{ color: "var(--background)" }} strokeWidth={3} />}
              </span>
              <span className="min-w-0 truncate">{branch.name}</span>
            </button>
          );
        })}
      </div>
      {matches.length > SHOW && (
        <p className="mt-1.5 text-xs text-fog/70">
          Showing {SHOW} of {matches.length}. Type in the box to narrow the list.
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-fog/70">{value.length} selected</span>
        <span className="flex gap-3">
          <button type="button" className="text-aurora-a hover:underline" onClick={selectShown}>
            Select shown
          </button>
          <button type="button" className="text-fog hover:text-strong hover:underline" onClick={() => onChange([])}>
            Clear
          </button>
        </span>
      </div>
    </div>
  );
}
