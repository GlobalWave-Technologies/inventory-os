import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Check, ChevronRight, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { askConfirm } from "@/components/ConfirmDialog";
import { apiPost, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const CARD = "mt-4 flex items-center justify-between gap-4 rounded-xl border border-hair p-3";

const WHAT: Record<string, string> = {
  branch: "Branch",
  category: "Category",
  product: "Product",
  stock_record: "Stock record",
  user: "Staff account",
};

type Req = {
  id: number;
  entityType: string;
  label: string;
  reason: string | null;
  status: string;
  requestedByName: string;
  requestedAt: string;
};

type BinItem = {
  type: string;
  id: number | string;
  productId: number | string | null;
  label: string;
  deletedAt: string;
  deletedByName: string | null;
  restoreUntil: string;
};

// The server may send snake_case or camelCase: accept both.
const camel = (key: string) => key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
function norm<T>(row: unknown): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) out[camel(k)] = v;
  return out as T;
}

const day = (iso: string) => new Date(iso).toLocaleDateString();
const daysLeft = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));

const STATUS_COLOUR: Record<string, string> = {
  pending: "text-amber",
  approved: "text-aurora-a",
  rejected: "text-rose",
  cancelled: "text-fog",
};

function useAccess() {
  const auth = useAuth() as unknown as { isAdmin: boolean; user?: { role?: string } | null };
  return { isAdmin: Boolean(auth.isAdmin), blocked: auth.user?.role === "staff" };
}

function Fold(props: { title: string; hint: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className={CARD}>
      <button
        type="button"
        onClick={props.onToggle}
        aria-expanded={props.open}
        className="flex w-full items-center gap-2 text-left"
      >
        <ChevronRight
          className={`size-4 shrink-0 text-fog transition-transform duration-200 ${props.open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-strong">{props.title}</span>
          <span className="block text-xs text-fog">{props.hint}</span>
        </span>
      </button>
      {props.open && <div className="mt-4">{props.children}</div>}
    </section>
  );
}

const ROW = "flex flex-col gap-3 border-t border-hair py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between";
const BTN = "flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-hair px-3 py-2 text-xs disabled:opacity-50 sm:flex-none";

/* ------------------------- Deletion requests ------------------------- */

export function DeletionRequests() {
  const { isAdmin, blocked } = useAccess();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["deletion-requests", isAdmin],
    enabled: !blocked,
    retry: false,
    staleTime: 15_000,
    queryFn: async () => {
      const r = await apiRequest<{ items: unknown[] }>(isAdmin ? "/deletions?status=pending&limit=50" : "/deletions?limit=20");
      return r.items.map((x) => norm<Req>(x));
    },
  });

  if (blocked || query.isError) return null;
  const items = query.data ?? [];

  async function act(r: Req, action: "approve" | "reject" | "cancel") {
    if (action === "approve") {
      const ok = await askConfirm({
        title: `Delete “${r.label}”?`,
        message: "It moves to the Recycle bin, where it can be restored until its time runs out.",
        confirmLabel: "Approve and delete",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusyId(r.id);
    try {
      await apiPost(`/deletions/${r.id}/${action}`, {});
      toast.success(action === "approve" ? "Approved and deleted" : action === "reject" ? "Request rejected" : "Request cancelled");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update that request.");
    } finally {
      setBusyId(null);
    }
  }

  const waiting = items.filter((r) => r.status === "pending").length;

  return (
    <Fold
      title={isAdmin ? "Deletion requests" : "My deletion requests"}
      hint={waiting > 0 ? `${waiting} waiting` : isAdmin ? "Nothing is waiting for you" : "Requests you sent to the administrator"}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {query.isLoading ? (
        <p className="text-xs text-fog">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-fog">No requests.</p>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto overscroll-contain pr-1">
          {items.map((r) => (
            <li key={r.id} className={ROW}>
              <div className="min-w-0">
                <p className="break-words text-sm text-strong">{r.label}</p>
                <p className="text-xs text-fog">
                  {WHAT[r.entityType] ?? r.entityType}
                  {isAdmin ? ` · asked by ${r.requestedByName}` : ""} · {day(r.requestedAt)}
                  {r.status !== "pending" && (
                    <span className={`ml-1 ${STATUS_COLOUR[r.status] ?? "text-fog"}`}>· {r.status}</span>
                  )}
                </p>
                {r.reason ? <p className="mt-1 break-words text-xs text-fog">“{r.reason}”</p> : null}
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2">
                  {isAdmin ? (
                    <>
                      <button type="button" disabled={busyId === r.id} onClick={() => void act(r, "approve")} className={`${BTN} text-rose`}>
                        <Check className="size-3.5" /> Approve
                      </button>
                      <button type="button" disabled={busyId === r.id} onClick={() => void act(r, "reject")} className={`${BTN} text-fog hover:text-strong`}>
                        <X className="size-3.5" /> Reject
                      </button>
                    </>
                  ) : (
                    <button type="button" disabled={busyId === r.id} onClick={() => void act(r, "cancel")} className={`${BTN} text-fog hover:text-strong`}>
                      <X className="size-3.5" /> Cancel request
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Fold>
  );
}

/* ----------------------------- Recycle bin ----------------------------- */

export function RecycleBin() {
  const { isAdmin, blocked } = useAccess();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["recycle-bin", isAdmin],
    enabled: !blocked,
    retry: false,
    staleTime: 15_000,
    queryFn: async () => {
      const r = await apiRequest<{ items: unknown[] }>("/recycle-bin");
      return r.items.map((x) => norm<BinItem>(x));
    },
  });

  if (blocked || query.isError) return null;
  const items = query.data ?? [];
  const keyOf = (i: BinItem) => `${i.type}:${i.id}:${i.productId ?? ""}`;

  async function restore(i: BinItem) {
    setBusyKey(keyOf(i));
    try {
      await apiPost("/recycle-bin/restore", {
        type: i.type,
        id: Number(i.id),
        ...(i.productId !== null && i.productId !== undefined ? { productId: Number(i.productId) } : {}),
      });
      toast.success(`${i.label} restored`);
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore that.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Fold
      title="Recycle bin"
      hint={
        items.length > 0
          ? `${items.length >= 500 ? "500+ (newest shown)" : items.length} item(s) · ${isAdmin ? "kept 60 days when you delete, 30 days when a manager does" : "kept 30 days"}`
          : "Deleted items can be restored here"
      }
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {query.isLoading ? (
        <p className="text-xs text-fog">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-fog">The Recycle bin is empty.</p>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto overscroll-contain pr-1">
          {items.map((i) => (
            <li key={keyOf(i)} className={ROW}>
              <div className="min-w-0">
                <p className="break-words text-sm text-strong">{i.label}</p>
                <p className="text-xs text-fog">
                  {WHAT[i.type] ?? i.type} · deleted {day(i.deletedAt)}
                  {isAdmin && i.deletedByName ? ` by ${i.deletedByName}` : ""} ·{" "}
                  <span className={daysLeft(i.restoreUntil) <= 5 ? "text-amber" : ""}>{daysLeft(i.restoreUntil)} day(s) left</span>
                </p>
              </div>
              <button
                type="button"
                disabled={busyKey === keyOf(i)}
                onClick={() => void restore(i)}
                className={`${BTN} text-fog hover:text-strong`}
              >
                <ArchiveRestore className="size-3.5" /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </Fold>
  );
}
