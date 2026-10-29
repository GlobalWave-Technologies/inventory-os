import { useState } from "react";
import { toast } from "sonner";
import { GhostButton, PrimaryButton } from "@/components/AppShell";
import { errorMessage } from "@/lib/errors";
import { useCount, useSaveCountLine, useSubmitCount } from "@/lib/counts";
import { useSingleFlight } from "@/lib/useSingleFlight";

const SHOW_AT_A_TIME = 50;

function CountRow({
  countId,
  productId,
  name,
  sku,
  shelf,
  initial,
  expected,
  difference,
  editable,
}: {
  countId: number;
  productId: number;
  name: string;
  sku: string;
  shelf?: string | null;
  initial?: number;
  expected?: number;
  difference?: number;
  editable: boolean;
}) {
  const save = useSaveCountLine(countId);
  const { run, pending } = useSingleFlight();
  const [value, setValue] = useState(initial === undefined ? "" : String(initial));
  const busy = pending || save.isPending;

  async function saveNow() {
    const counted = Number(value);
    if (value.trim() === "" || !Number.isInteger(counted) || counted < 0 || counted > 1_000_000) {
      toast.error("Enter the number you counted, 0 or more.");
      return;
    }
    try {
      await save.mutateAsync({ productId, countedQuantity: counted });
      toast.success(`${name}: ${counted} saved`);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save that count."));
    }
  }

  return (
    <div className="rounded-xl border border-hair bg-panel/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-strong">{name}</p>
          <p className="label-mono mt-0.5">
            {sku}
            {shelf ? ` · ${shelf}` : ""}
          </p>
        </div>
        {expected !== undefined && difference !== undefined && (
          <div className="text-right">
            <p className="label-mono">Expected {expected}</p>
            <p className={`num text-xs font-semibold ${difference === 0 ? "text-fog" : difference < 0 ? "text-rose" : "text-aurora-a"}`}>
              {difference === 0 ? "Matches" : difference > 0 ? `+${difference}` : difference}
            </p>
          </div>
        )}
      </div>
      {editable ? (
        <div className="mt-2 flex gap-2">
          <input
            className="field"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Counted"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <PrimaryButton onClick={() => void run(saveNow)} disabled={busy}>
            {busy ? "…" : initial === undefined ? "Save" : "Update"}
          </PrimaryButton>
        </div>
      ) : (
        initial !== undefined && <p className="num mt-2 text-sm text-strong">Counted {initial}</p>
      )}
    </div>
  );
}

export function CountView({ countId, onBack }: { countId: number; onBack: () => void }) {
  const query = useCount(countId);
  const submit = useSubmitCount(countId);
  const { run, pending } = useSingleFlight();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const count = query.data;
  const open = count?.status === "open";

  async function submitNow() {
    if (!confirm("Submit this count? Every difference becomes an adjustment request for approval.")) return;
    try {
      const result = await submit.mutateAsync();
      toast.success(
        result.adjustmentsCreated === 0
          ? "Count submitted. Everything matched."
          : `Count submitted. ${result.adjustmentsCreated} adjustment request(s) created.`,
      );
      onBack();
    } catch (error) {
      // For example "Count every product first. Still to count: …"
      toast.error(errorMessage(error, "Could not submit the count."));
    }
  }

  if (query.isLoading) return <p className="text-sm text-fog/70">Loading the count…</p>;
  if (query.isError || !count) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load this count.</p>
        <GhostButton onClick={onBack}>Back</GhostButton>
      </div>
    );
  }

  const needle = search.trim().toLowerCase();
  const remaining = count.remaining.filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.sku.toLowerCase().includes(needle));
  const visibleRemaining = showAll ? remaining : remaining.slice(0, SHOW_AT_A_TIME);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <GhostButton onClick={onBack}>Back</GhostButton>
        {open && (
          <PrimaryButton onClick={() => void run(submitNow)} disabled={pending || submit.isPending || count.remaining.length > 0}>
            {pending || submit.isPending ? "Submitting…" : "Submit count"}
          </PrimaryButton>
        )}
      </div>
      <p className="text-sm text-fog">
        {open
          ? `Count what is physically on the shelf. ${count.remaining.length} product(s) still to count, ${count.lines.length} done. You do not see the system quantity.`
          : `Submitted ${count.submittedAt ? new Date(count.submittedAt).toLocaleString() : ""}.`}
      </p>

      {open && count.remaining.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-strong">To count</h2>
          <input className="field" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {visibleRemaining.map((r) => (
            <CountRow key={r.productId} countId={countId} productId={r.productId} name={r.name} sku={r.sku} shelf={r.shelf} editable />
          ))}
          {!showAll && remaining.length > SHOW_AT_A_TIME && (
            <GhostButton onClick={() => setShowAll(true)}>Show all {remaining.length}</GhostButton>
          )}
        </section>
      )}

      {count.lines.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-strong">Counted</h2>
          {count.lines.map((line) => (
            <CountRow
              key={`${line.productId}-${line.countedQuantity}`}
              countId={countId}
              productId={line.productId}
              name={line.name}
              sku={line.sku}
              initial={line.countedQuantity}
              {...(line.expectedQuantity !== undefined ? { expected: line.expectedQuantity } : {})}
              {...(line.difference !== undefined ? { difference: line.difference } : {})}
              editable={open}
            />
          ))}
        </section>
      )}
    </div>
  );
}
