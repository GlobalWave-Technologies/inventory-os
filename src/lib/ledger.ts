import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { useHydrated } from "./theme";
import { useAuth } from "./auth";
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

/** Data visible to the signed-in user. Staff can only work in assigned categories. */
export function useAccessibleCategories(): Category[] | undefined {
  const categories = useCategories();
  const { user } = useAuth();
  if (!categories || !user) return categories;
  return user.role === "admin" ? categories : categories.filter((category) => user.categoryIds.includes(category.id));
}

export function useAccessibleItems(): Item[] | undefined {
  const items = useItems();
  const { user } = useAuth();
  if (!items || !user) return items;
  return user.role === "admin" ? items : items.filter((item) => user.categoryIds.includes(item.categoryId));
}

export function useAccessibleActivity(limit = 60): Activity[] | undefined {
  const activity = useActivity(limit);
  const { user } = useAuth();
  if (!activity || !user) return activity;
  return user.role === "admin" ? activity : activity.filter((entry) => entry.categoryId && user.categoryIds.includes(entry.categoryId));
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
