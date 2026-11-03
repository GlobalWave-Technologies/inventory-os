import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { askConfirm } from "@/components/ConfirmDialog";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export type DeleteType = "branch" | "category" | "product" | "stock_record" | "user";

const WHAT: Record<DeleteType, string> = {
  branch: "branch",
  category: "category",
  product: "product",
  stock_record: "stock record",
  user: "staff account",
};

type Props = {
  type: DeleteType;
  id: string | number;
  productId?: string | number | undefined;
  name: string;
  variant?: "text" | "icon" | undefined;
};

/**
 * Admin: deletes now (the item goes to the Recycle bin for 60 days).
 * Manager: sends a request that an admin must approve.
 * The server decides who is allowed; this button only explains what will happen.
 */
export function DeleteButton({ type, id, productId, name, variant = "text" }: Props) {
  const auth = useAuth();
  const { isAdmin } = auth;
  const isStaff = (auth as unknown as { user?: { role?: string } | null }).user?.role === "staff";
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function run() {
    const ok = await askConfirm({
      title: isAdmin ? `Delete “${name}”?` : `Ask to delete “${name}”?`,
      message: isAdmin
        ? `This ${WHAT[type]} moves to the Recycle bin in Settings. You can restore it for 60 days.`
        : `An administrator has to approve this first. Nothing is deleted until they do.`,
      confirmLabel: isAdmin ? "Delete" : "Send request",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const body = {
        type,
        id: Number(id),
        ...(productId !== undefined ? { productId: Number(productId) } : {}),
      };
      const result = await apiPost<{ deleted?: boolean; requested?: boolean }>("/deletions", body);
      toast.success(result.requested ? "Request sent to the administrator" : `${name} deleted`);
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that.");
    } finally {
      setBusy(false);
    }
  }

  if (isStaff) return null;

  const label = isAdmin ? "Delete" : "Request delete";

  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-label={`${label} ${name}`}
        title={label}
        disabled={busy}
        onClick={() => void run()}
        className="grid size-8 place-items-center rounded-lg border border-hair text-fog hover:text-rose disabled:opacity-50"
      >
        <Trash2 className="size-3.5" />
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void run()}
      className="flex-1 rounded-lg border border-hair px-2.5 py-2 text-xs text-rose disabled:opacity-50 sm:flex-none"
    >
      {label}
    </button>
  );
}
