import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { useHydrated } from "./theme";
import {
  itemHistory,
  listActivity,
  listCategories,
  listItems,
  seedIfEmpty,
  type Activity,
  type Category,
  type Item,
} from "./db";

export function useBootstrap() {
  const hydrated = useHydrated();
  useEffect(() => {
    if (hydrated) void seedIfEmpty();
  }, [hydrated]);
}

export function useCategories(): Category[] | undefined {
  const hydrated = useHydrated();
  return useLiveQuery(() => (hydrated ? listCategories() : undefined), [hydrated]);
}

export function useItems(): Item[] | undefined {
  const hydrated = useHydrated();
  return useLiveQuery(() => (hydrated ? listItems() : undefined), [hydrated]);
}

export function useActivity(limit = 60): Activity[] | undefined {
  const hydrated = useHydrated();
  return useLiveQuery(() => (hydrated ? listActivity(limit) : undefined), [hydrated, limit]);
}

export function useItemHistory(itemId: string | null): Activity[] | undefined {
  const hydrated = useHydrated();
  return useLiveQuery(
    () => (hydrated && itemId ? itemHistory(itemId) : undefined),
    [hydrated, itemId],
  );
}

export const accentVar = (accent: Category["accent"]) =>
  accent === "amber"
    ? "var(--amber)"
    : accent === "rose"
      ? "var(--rose)"
      : accent === "b"
        ? "var(--aurora-b)"
        : accent === "c"
          ? "var(--aurora-c)"
          : "var(--aurora-a)";

export const isLow = (item: Item) => item.quantity <= item.lowStockThreshold;

export const stockValue = (items: Item[]) =>
  items.reduce((sum, i) => sum + i.quantity * i.unitValue, 0);

export const statusLabel: Record<Item["status"], string> = {
  "in-stock": "In stock",
  reserved: "Reserved",
  damaged: "Damaged",
  archived: "Archived",
};
