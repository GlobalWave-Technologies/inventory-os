import { Boxes } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useAccessibleCategories } from "@/lib/ledger";

export function PortalPicker() {
  const { user, selectPortal, logout } = useAuth();
  const portals = useAccessibleCategories();

  useEffect(() => {
    if (user?.role === "staff" && portals?.length === 1) void selectPortal(portals[0].id);
  }, [user?.id, user?.role, portals, selectPortal]);

  return <main className="grid min-h-screen place-items-center p-4 text-fog"><section className="glass w-full max-w-xl rounded-3xl p-6 sm:p-8"><p className="label-mono">Restricted workspace</p><h1 className="mt-2 font-display text-3xl text-strong">Choose your portal</h1><p className="mt-2 text-sm text-fog/80">Only portals assigned to your account are shown.</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{portals?.map((portal) => <button key={portal.id} onClick={() => void selectPortal(portal.id).then((ok) => !ok && toast.error("You do not have access to this portal."))} className="rounded-2xl border border-hair bg-panel/60 p-4 text-left hover:border-aurora-a/50"><Boxes className="size-5 text-aurora-a" /><p className="mt-3 font-medium text-strong">{portal.name}</p><p className="mt-1 text-xs text-fog/70">Open portal</p></button>)}</div>{portals?.length === 0 && <p className="mt-6 rounded-xl border border-amber/30 p-3 text-sm text-amber">No portal is assigned to this account. Contact an administrator.</p>}<button onClick={logout} className="mt-6 text-sm text-fog/70 hover:text-strong">Sign out</button></section></main>;
}
