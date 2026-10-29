import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { OrderModal, RequestModal, SupplierModal } from "@/components/PurchasingModals";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { cedi } from "@/lib/format";
import { useScopeLocationId } from "@/lib/overview";
import {
  useDecideStockRequest,
  useOrderAction,
  useOrders,
  useStockRequests,
  useSuppliers,
  type OrderStatus,
  type PurchaseOrder,
  type RequestStatus,
  type StockRequest,
  type Supplier,
} from "@/lib/purchasing";
import { useMyBranches } from "@/lib/sales";
import { useSingleFlight } from "@/lib/useSingleFlight";

export const Route = createFileRoute("/purchasing")({
  head: () => ({
    meta: [
      { title: "Purchasing — StockLine Inventory" },
      { name: "description", content: "Purchase orders, suppliers and stock requests." },
    ],
  }),
  component: PurchasingPage,
});

type Tab = "requests" | "orders" | "suppliers";

function PurchasingPage() {
  const { isAdmin, managerSectionEnabled, user } = useAuth();
  const canOrder = isAdmin || (managerSectionEnabled && user?.role === "manager");
  const branches = useMyBranches();
  const scopeId = useScopeLocationId();
  const [tab, setTab] = useState<Tab>("requests");
  const [modal, setModal] = useState<"order" | "request" | "supplier" | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const active: Tab = !canOrder ? "requests" : tab;
  const nameOf = (id: number) => branches.find((b) => b.id === id)?.name ?? `Branch ${id}`;

  const action =
    active === "orders" ? (
      <PrimaryButton onClick={() => setModal("order")}>New order</PrimaryButton>
    ) : active === "suppliers" ? (
      <PrimaryButton
        onClick={() => {
          setEditing(null);
          setModal("supplier");
        }}
      >
        Add supplier
      </PrimaryButton>
    ) : (
      <PrimaryButton onClick={() => setModal("request")}>Request stock</PrimaryButton>
    );

  return (
    <AppShell eyebrow="Stock" title="Purchasing" actions={action}>
      <div className="flex flex-col gap-4">
        {canOrder && (
          <div className="flex flex-wrap gap-2">
            {(["requests", "orders", "suppliers"] as const).map((t) => (
              <GhostButton key={t} onClick={() => setTab(t)} className={active === t ? "!border-aurora-a/50 !text-strong" : ""}>
                {t === "requests" ? "Stock requests" : t === "orders" ? "Purchase orders" : "Suppliers"}
              </GhostButton>
            ))}
          </div>
        )}
        {active === "requests" && <Requests nameOf={nameOf} />}
        {active === "orders" && <Orders nameOf={nameOf} />}
        {active === "suppliers" && (
          <Suppliers
            isAdmin={isAdmin}
            onEdit={(s) => {
              setEditing(s);
              setModal("supplier");
            }}
          />
        )}
      </div>

      {modal === "order" && <OrderModal onClose={() => setModal(null)} branches={branches} defaultBranchId={scopeId} />}
      {modal === "request" && <RequestModal onClose={() => setModal(null)} branches={branches} defaultBranchId={scopeId} />}
      {modal === "supplier" && <SupplierModal onClose={() => setModal(null)} supplier={editing} />}
    </AppShell>
  );
}

// ---- Stock requests --------------------------------------------------------------------------

const REQUEST_FILTERS: { value: RequestStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function Requests({ nameOf }: { nameOf: (id: number) => string }) {
  const { user, isAdmin, managerSectionEnabled } = useAuth();
  const [filter, setFilter] = useState<RequestStatus | "all">("pending");
  const query = useStockRequests(filter);
  const decide = useDecideStockRequest();
  const { run, pending } = useSingleFlight();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  // Mirrors the server: decide at branches you manage, never your own request (except an admin while managers are off).
  function canDecide(r: StockRequest) {
    if (!user || r.status !== "pending") return false;
    const manages = isAdmin || (managerSectionEnabled && user.role === "manager" && user.branchIds.includes(String(r.locationId)));
    if (!manages) return false;
    return String(r.requestedBy) !== user.id || (isAdmin && !managerSectionEnabled);
  }

  async function decideNow(r: StockRequest, action: "approve" | "reject") {
    try {
      await decide.mutateAsync({ id: r.id, action });
      toast.success(action === "approve" ? "Request approved" : "Request rejected");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the decision."));
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {REQUEST_FILTERS.map((f) => (
          <GhostButton key={f.value} onClick={() => setFilter(f.value)} className={filter === f.value ? "!border-aurora-a/50 !text-strong" : ""}>
            {f.label}
          </GhostButton>
        ))}
      </div>
      {query.isLoading && <LoadingPanels count={3} />}
      {query.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load requests.</p>}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyState icon={<ShoppingCart className="size-6" />} title="No requests" body="Nothing matches this filter." />
      )}
      <div className="flex flex-col gap-2">
        {items.map((r) => (
          <div key={r.id} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-strong">{r.itemName}</p>
                <p className="label-mono mt-0.5">
                  {nameOf(r.locationId)} · {r.requestedByName}
                </p>
              </div>
              <p className="num text-xl font-semibold text-strong">{r.quantity}</p>
            </div>
            {r.note && <p className="mt-1.5 break-words text-sm text-fog">{r.note}</p>}
            <p className="label-mono mt-1.5">
              {new Date(r.createdAt).toLocaleDateString()} · {r.status}
            </p>
            {canDecide(r) && (
              <div className="mt-3 flex gap-2">
                <PrimaryButton disabled={pending || decide.isPending} onClick={() => void run(() => decideNow(r, "approve"))}>
                  Approve
                </PrimaryButton>
                <GhostButton onClick={() => void run(() => decideNow(r, "reject"))}>Reject</GhostButton>
              </div>
            )}
          </div>
        ))}
      </div>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <GhostButton onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load more"}</GhostButton>
        </div>
      )}
    </>
  );
}

// ---- Purchase orders -------------------------------------------------------------------------

const ORDER_FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "ordered", label: "Ordered" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

function Orders({ nameOf }: { nameOf: (id: number) => string }) {
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState<OrderStatus | "all">("ordered");
  const query = useOrders(filter, true);
  const act = useOrderAction();
  const { run, pending } = useSingleFlight();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  async function actNow(o: PurchaseOrder, action: "receive" | "cancel") {
    if (action === "cancel" && !confirm("Cancel this order?")) return;
    try {
      await act.mutateAsync({ id: o.id, action });
      toast.success(action === "receive" ? "Received. Stock added and cost updated." : "Order cancelled");
    } catch (error) {
      toast.error(errorMessage(error, "That did not go through."));
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ORDER_FILTERS.map((f) => (
          <GhostButton key={f.value} onClick={() => setFilter(f.value)} className={filter === f.value ? "!border-aurora-a/50 !text-strong" : ""}>
            {f.label}
          </GhostButton>
        ))}
      </div>
      {query.isLoading && <LoadingPanels count={3} />}
      {query.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load orders.</p>}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyState icon={<ShoppingCart className="size-6" />} title="No orders" body="Nothing matches this filter." />
      )}
      <div className="flex flex-col gap-2">
        {items.map((o) => (
          <div key={o.id} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-strong">{o.productName}</p>
                <p className="label-mono mt-0.5">
                  {o.supplierName} → {nameOf(o.locationId)}
                </p>
              </div>
              <div className="text-right">
                <p className="num text-base font-semibold text-strong">{o.quantity} × {cedi(o.unitCost)}</p>
                <p className="label-mono">Total {cedi(o.total)}</p>
              </div>
            </div>
            <p className="label-mono mt-1.5">
              {new Date(o.createdAt).toLocaleDateString()} · {o.status}
            </p>
            {o.status === "ordered" && (
              <div className="mt-3 flex gap-2">
                {isAdmin && (
                  <PrimaryButton disabled={pending || act.isPending} onClick={() => void run(() => actNow(o, "receive"))}>
                    Mark received
                  </PrimaryButton>
                )}
                <GhostButton onClick={() => void run(() => actNow(o, "cancel"))}>Cancel order</GhostButton>
              </div>
            )}
          </div>
        ))}
      </div>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <GhostButton onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load more"}</GhostButton>
        </div>
      )}
    </>
  );
}

// ---- Suppliers -------------------------------------------------------------------------------

function Suppliers({ isAdmin, onEdit }: { isAdmin: boolean; onEdit: (s: Supplier) => void }) {
  const query = useSuppliers(true);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <>
      {query.isLoading && <LoadingPanels count={3} />}
      {query.isError && <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">Could not load suppliers.</p>}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyState icon={<ShoppingCart className="size-6" />} title="No suppliers" body={isAdmin ? "Add the businesses you buy from." : "An admin can add suppliers."} />
      )}
      <div className="flex flex-col gap-2">
        {items.map((s) => (
          <div key={s.id} className="rounded-2xl border border-hair bg-panel/40 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-strong">{s.name}</p>
                <p className="label-mono mt-0.5 break-all">
                  {[s.contact, s.email].filter(Boolean).join(" · ") || "No contact details"}
                </p>
              </div>
              {isAdmin && <GhostButton onClick={() => onEdit(s)}>Edit</GhostButton>}
            </div>
            {s.notes && <p className="mt-1.5 break-words text-sm text-fog">{s.notes}</p>}
          </div>
        ))}
      </div>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <GhostButton onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Load more"}</GhostButton>
        </div>
      )}
    </>
  );
}
