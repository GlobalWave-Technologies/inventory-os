import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PrimaryButton } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { useEmailKinds, useMyEmailPref, useSetEmailKinds, useSetMyEmailPref } from "@/lib/emailSettings";
import { errorMessage } from "@/lib/errors";
import { useSingleFlight } from "@/lib/useSingleFlight";

const GROUPS: { title: string; kinds: { kind: string; label: string }[] }[] = [
  {
    title: "Stock",
    kinds: [
      { kind: "low_stock", label: "Low stock" },
      { kind: "out_of_stock", label: "Out of stock" },
    ],
  },
  {
    title: "Requests and approvals",
    kinds: [
      { kind: "transfer_requested", label: "A transfer needs approval" },
      { kind: "transfer_approved", label: "A transfer was approved" },
      { kind: "transfer_rejected", label: "A transfer was rejected" },
      { kind: "transfer_cancelled", label: "A transfer was cancelled" },
      { kind: "transfer_dispatched", label: "A transfer is on its way" },
      { kind: "transfer_received", label: "A transfer was received" },
      { kind: "adjustment_requested", label: "An adjustment needs approval" },
      { kind: "adjustment_approved", label: "An adjustment was approved" },
      { kind: "adjustment_rejected", label: "An adjustment was rejected" },
      { kind: "unusual_adjustment", label: "An unusually large adjustment" },
      { kind: "stock_request_submitted", label: "A stock request needs approval" },
      { kind: "stock_request_approved", label: "A stock request was approved" },
      { kind: "stock_request_rejected", label: "A stock request was rejected" },
    ],
  },
  {
    title: "Stocktaking",
    kinds: [
      { kind: "count_due", label: "A weekly count is due" },
      { kind: "count_overdue", label: "A weekly count is overdue or missed" },
      { kind: "count_submitted", label: "A count was submitted" },
    ],
  },
  {
    title: "Purchasing",
    kinds: [
      { kind: "purchase_order_created", label: "A purchase order was created" },
      { kind: "purchase_order_received", label: "A purchase order arrived" },
      { kind: "purchase_order_cancelled", label: "A purchase order was cancelled" },
    ],
  },
  {
    title: "Sales",
    kinds: [
      { kind: "sales_report_submitted", label: "A sales report was submitted" },
      { kind: "sales_summary_submitted", label: "A daily summary was submitted" },
      { kind: "return_recorded", label: "A sales return was recorded" },
    ],
  },
  {
    title: "Security",
    kinds: [
      { kind: "account_locked", label: "An account was locked" },
      { kind: "password_changed", label: "A password was changed" },
    ],
  },
];

// Who receives each one. "Approvers" are the branch's managers, or the admins when managers are switched off.
const RECIPIENTS: Record<string, string> = {
  low_stock: "Approvers at that branch",
  out_of_stock: "Approvers at that branch",
  transfer_requested: "Approvers at the sending branch",
  transfer_approved: "Staff and managers at the sending branch",
  transfer_rejected: "The person who asked",
  transfer_cancelled: "The person who asked, and approvers",
  transfer_dispatched: "Staff and managers at the receiving branch",
  transfer_received: "The person who asked, and approvers",
  adjustment_requested: "Approvers at that branch",
  adjustment_approved: "The person who asked",
  adjustment_rejected: "The person who asked",
  unusual_adjustment: "Admins",
  stock_request_submitted: "Approvers at that branch",
  stock_request_approved: "The person who asked",
  stock_request_rejected: "The person who asked",
  count_due: "Staff at that branch",
  count_overdue: "Managers, then admins",
  count_submitted: "Approvers at that branch",
  purchase_order_created: "Admins",
  purchase_order_received: "The person who ordered, and approvers",
  purchase_order_cancelled: "The person who ordered, and admins",
  sales_report_submitted: "Approvers at that branch",
  sales_summary_submitted: "Admins",
  return_recorded: "Approvers at that branch",
  account_locked: "The person, and admins",
  password_changed: "The person",
};

export function EmailNotifications() {
  const { isAdmin } = useAuth();
  const pref = useMyEmailPref();
  const setPref = useSetMyEmailPref();
  const kinds = useEmailKinds();
  const setKinds = useSetEmailKinds();
  const mine = useSingleFlight();
  const save = useSingleFlight();
  const [selected, setSelected] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);

  const saved = kinds.data?.emailKinds;
  useEffect(() => {
    if (saved && !dirty) setSelected(saved);
  }, [saved, dirty]);

  const toggle = (kind: string, on: boolean) => {
    setDirty(true);
    setSelected((current) => (on ? [...new Set([...current, kind])] : current.filter((k) => k !== kind)));
  };

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="label-mono block">Alerts</span>
          <span className="mt-1 block font-display text-lg font-semibold text-strong">Email notifications</span>
        </span>
        <ChevronRight className={`size-5 shrink-0 text-fog transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
      <div>
      <p className="mt-1 max-w-2xl text-sm text-fog/75">
        Emails only say that something needs your attention. They never include product names, quantities, prices or
        amounts. Those stay inside the app, behind sign-in. Everything still shows in Notifications either way.
      </p>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-hair p-3">
        <div>
          <p className="text-sm font-medium text-strong">Email me</p>
          <p className="text-xs text-fog/70">Turn this off to stop all notification emails to you.</p>
        </div>
        <Switch
          checked={pref.data?.notifyEmail ?? true}
          disabled={pref.isLoading || mine.pending}
          aria-label="Email me notifications"
          onCheckedChange={(checked) =>
            void mine.run(async () => {
              try {
                await setPref.mutateAsync(checked);
                toast.success(checked ? "Email notifications on" : "Email notifications off");
              } catch (error) {
                toast.error(errorMessage(error, "Could not update that."));
              }
            })
          }
        />
      </div>

      {isAdmin && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-strong">What gets emailed</h3>
          <p className="mt-1 text-xs text-fog/70">One list for the whole system. Each person can still switch all email off for themselves above. Approvers are the branch managers, or the admins when managers are switched off.</p>
          {kinds.isLoading && <p className="mt-3 text-sm text-fog/70">Loading…</p>}
          {kinds.isError && <p className="mt-3 text-sm text-amber">Could not load the list.</p>}
          {saved && (
            <>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="label-mono">{group.title}</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {group.kinds.map((item) => (
                        <div key={item.kind} className="flex items-start justify-between gap-3 rounded-xl border border-hair px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm text-strong">{item.label}</p>
                            <p className="text-xs text-fog/60">To: {RECIPIENTS[item.kind] ?? "Everyone involved"}</p>
                          </div>
                          <Switch
                            checked={selected.includes(item.kind)}
                            aria-label={item.label}
                            onCheckedChange={(on) => toggle(item.kind, on)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <PrimaryButton
                  disabled={!dirty || save.pending}
                  onClick={() =>
                    void save.run(async () => {
                      try {
                        await setKinds.mutateAsync(selected);
                        setDirty(false);
                        toast.success("Email settings saved");
                      } catch (error) {
                        toast.error(errorMessage(error, "Could not save the email settings."));
                      }
                    })
                  }
                >
                  {save.pending ? "Saving…" : "Save email settings"}
                </PrimaryButton>
              </div>
            </>
          )}
        </div>
      )}
      </div>
      )}
    </section>
  );
}
