import Dexie, { type Table } from "dexie";

export type AttributeType = "text" | "number" | "date" | "select";

export interface AttributeDef {
  id: string;
  name: string;
  type: AttributeType;
  options?: string[];
  required?: boolean;
}

export interface Category {
  id: string;
  name: string;
  accent: "a" | "b" | "c" | "amber" | "rose";
  attributes: AttributeDef[];
  createdAt: string;
}

export type UserRole = "admin" | "staff";

export interface User {
  id: string;
  name: string;
  email: string;
  /** Local-only demo credential. Use a server-side auth provider before production deployment. */
  password: string;
  role: UserRole;
  categoryIds: string[];
  createdAt: string;
}

export type ItemStatus = "in-stock" | "reserved" | "damaged" | "archived";

export interface Item {
  id: string;
  categoryId: string;
  name: string;
  quantity: number;
  lowStockThreshold: number;
  location: string;
  unitValue: number;
  status: ItemStatus;
  dateAdded: string;
  notes?: string;
  custom: Record<string, string | number>;
  updatedAt: string;
}

export type ActivityKind =
  | "item-created"
  | "item-updated"
  | "item-deleted"
  | "stock-adjusted"
  | "category-created"
  | "category-updated"
  | "category-deleted"
  | "data-imported";

export interface Activity {
  id: string;
  kind: ActivityKind;
  message: string;
  itemId?: string;
  categoryId?: string;
  delta?: number;
  reason?: string;
  at: string;
}

class LedgerDB extends Dexie {
  categories!: Table<Category, string>;
  items!: Table<Item, string>;
  activity!: Table<Activity, string>;
  users!: Table<User, string>;

  constructor() {
    super("northern-ledger");
    this.version(1).stores({
      categories: "id, name, createdAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt",
      activity: "id, at, kind, itemId",
    });
    this.version(2).stores({
      categories: "id, name, createdAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt",
      activity: "id, at, kind, itemId",
      users: "id, &email, role, createdAt",
    });
  }
}

let instance: LedgerDB | null = null;

/** Browser-only Dexie handle. Never call during SSR. */
export function db(): LedgerDB {
  if (typeof window === "undefined") {
    throw new Error("The local database is only available in the browser.");
  }
  if (!instance) instance = new LedgerDB();
  return instance;
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

async function log(entry: Omit<Activity, "id" | "at">) {
  await db().activity.add({ ...entry, id: uid(), at: new Date().toISOString() });
}

/* ---------------- users & access ---------------- */

export async function ensureDefaultAdmin() {
  const existing = await db().users.where("email").equals("admin@veridian.local").first();
  if (existing) return existing;
  const admin: User = {
    id: uid(),
    name: "Administrator",
    email: "admin@veridian.local",
    password: "admin123",
    role: "admin",
    categoryIds: [],
    createdAt: new Date().toISOString(),
  };
  await db().users.add(admin);
  return admin;
}

export async function authenticate(email: string, password: string) {
  const user = await db().users.where("email").equals(email.trim().toLowerCase()).first();
  return user && user.password === password ? user : null;
}

export async function registerUser(input: Pick<User, "name" | "email" | "password">) {
  const email = input.email.trim().toLowerCase();
  const existing = await db().users.where("email").equals(email).first();
  if (existing) throw new Error("An account with this email already exists.");

  const user: User = {
    id: uid(),
    name: input.name.trim(),
    email,
    password: input.password,
    role: "staff",
    categoryIds: [],
    createdAt: new Date().toISOString(),
  };
  await db().users.add(user);
  return user;
}

export async function resetPassword(email: string, password: string) {
  const user = await db().users.where("email").equals(email.trim().toLowerCase()).first();
  if (!user) return false;
  await db().users.update(user.id, { password });
  return true;
}

export async function getUser(id: string) {
  return db().users.get(id);
}

export async function listUsers() {
  return db().users.orderBy("createdAt").toArray();
}

export async function createStaff(input: Pick<User, "name" | "email" | "password" | "categoryIds">) {
  const user: User = {
    id: uid(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    role: "staff",
    categoryIds: input.categoryIds,
    createdAt: new Date().toISOString(),
  };
  await db().users.add(user);
  return user;
}

export async function updateStaff(id: string, patch: Partial<Pick<User, "name" | "email" | "password" | "categoryIds">>) {
  await db().users.update(id, {
    ...patch,
    ...(patch.email ? { email: patch.email.trim().toLowerCase() } : {}),
  });
}

export async function deleteStaff(id: string) {
  const user = await db().users.get(id);
  if (user?.role === "admin") throw new Error("The administrator account cannot be deleted.");
  await db().users.delete(id);
}

/* ---------------- categories ---------------- */

export async function listCategories() {
  return db().categories.orderBy("createdAt").toArray();
}

export async function createCategory(
  input: Pick<Category, "name" | "accent" | "attributes">,
): Promise<Category> {
  const category: Category = {
    id: uid(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  await db().categories.add(category);
  await log({
    kind: "category-created",
    message: `Created category “${category.name}”`,
    categoryId: category.id,
  });
  return category;
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  await db().categories.update(id, patch);
  const c = await db().categories.get(id);
  await log({
    kind: "category-updated",
    message: `Updated category “${c?.name ?? ""}”`,
    categoryId: id,
  });
}

export async function deleteCategory(id: string) {
  const c = await db().categories.get(id);
  await db().items.where("categoryId").equals(id).delete();
  await db().categories.delete(id);
  await log({
    kind: "category-deleted",
    message: `Deleted category “${c?.name ?? ""}” and its items`,
  });
}

/* ---------------- items ---------------- */

export async function listItems() {
  return db().items.toArray();
}

export async function createItem(
  input: Omit<Item, "id" | "updatedAt" | "dateAdded"> & { dateAdded?: string },
): Promise<Item> {
  const now = new Date().toISOString();
  const item: Item = {
    ...input,
    dateAdded: input.dateAdded || now,
    id: uid(),
    updatedAt: now,
  };
  await db().items.add(item);
  await log({
    kind: "item-created",
    message: `Added ${item.name} (${item.quantity} in stock)`,
    itemId: item.id,
    categoryId: item.categoryId,
    delta: item.quantity,
  });
  return item;
}

export async function updateItem(id: string, patch: Partial<Item>) {
  const before = await db().items.get(id);
  await db().items.update(id, { ...patch, updatedAt: new Date().toISOString() });
  const after = await db().items.get(id);
  if (before && after && before.quantity !== after.quantity) {
    await log({
      kind: "stock-adjusted",
      message: `${after.name}: quantity ${before.quantity} → ${after.quantity}`,
      itemId: id,
      categoryId: after.categoryId,
      delta: after.quantity - before.quantity,
      reason: "Edited item",
    });
  } else if (after) {
    await log({
      kind: "item-updated",
      message: `Updated ${after.name}`,
      itemId: id,
      categoryId: after.categoryId,
    });
  }
}

export async function adjustStock(id: string, delta: number, reason: string) {
  const item = await db().items.get(id);
  if (!item) return;
  const next = Math.max(0, item.quantity + delta);
  await db().items.update(id, { quantity: next, updatedAt: new Date().toISOString() });
  await log({
    kind: "stock-adjusted",
    message: `${item.name}: ${item.quantity} → ${next}`,
    itemId: id,
    categoryId: item.categoryId,
    delta: next - item.quantity,
    reason: reason || "No reason given",
  });
}

export async function deleteItem(id: string) {
  const item = await db().items.get(id);
  await db().items.delete(id);
  if (item) {
    await log({ kind: "item-deleted", message: `Deleted ${item.name}`, categoryId: item.categoryId });
  }
}

/* ---------------- activity ---------------- */

export async function listActivity(limit = 100) {
  return db().activity.orderBy("at").reverse().limit(limit).toArray();
}

export async function itemHistory(itemId: string) {
  const rows = await db().activity.where("itemId").equals(itemId).toArray();
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

/* ---------------- seed ---------------- */

export async function seedIfEmpty() {
  await ensureDefaultAdmin();
  const count = await db().categories.count();
  if (count > 0) return;

  const doors = await createCategory({
    name: "Doors",
    accent: "a",
    attributes: [
      { id: uid(), name: "Material", type: "select", options: ["Oak", "Steel", "Pine", "Aluminium"] },
      { id: uid(), name: "Width (mm)", type: "number" },
      { id: uid(), name: "Height (mm)", type: "number" },
    ],
  });
  const laptops = await createCategory({
    name: "Laptops",
    accent: "b",
    attributes: [
      { id: uid(), name: "Brand", type: "text" },
      { id: uid(), name: "RAM (GB)", type: "number" },
      { id: uid(), name: "Warranty ends", type: "date" },
    ],
  });
  const goats = await createCategory({
    name: "Goats",
    accent: "c",
    attributes: [
      { id: uid(), name: "Breed", type: "select", options: ["Alpine", "Saanen", "West African Dwarf"] },
      { id: uid(), name: "Age (months)", type: "number" },
      { id: uid(), name: "Weight (kg)", type: "number" },
    ],
  });

  const seeds: Array<Omit<Item, "id" | "updatedAt">> = [
    {
      categoryId: doors.id,
      name: "Steel fire door, 900mm",
      quantity: 4,
      lowStockThreshold: 20,
      location: "Warehouse B, Tema",
      unitValue: 2150,
      status: "in-stock",
      dateAdded: new Date(Date.now() - 86400000 * 20).toISOString(),
      custom: { Material: "Steel", "Width (mm)": 900, "Height (mm)": 2100 },
    },
    {
      categoryId: doors.id,
      name: "Oak internal door, 750mm",
      quantity: 18,
      lowStockThreshold: 8,
      location: "Warehouse A, Accra",
      unitValue: 340,
      status: "in-stock",
      dateAdded: new Date(Date.now() - 86400000 * 12).toISOString(),
      custom: { Material: "Oak", "Width (mm)": 750, "Height (mm)": 2000 },
    },
    {
      categoryId: laptops.id,
      name: '14" ultrabook, 32GB',
      quantity: 2,
      lowStockThreshold: 15,
      location: "Office 2, Kumasi",
      unitValue: 18990,
      status: "in-stock",
      dateAdded: new Date(Date.now() - 86400000 * 6).toISOString(),
      custom: { Brand: "Lenovo", "RAM (GB)": 32, "Warranty ends": "2027-04-01" },
    },
    {
      categoryId: laptops.id,
      name: "Workstation, RTX 4090",
      quantity: 0,
      lowStockThreshold: 3,
      location: "Office 1, Accra",
      unitValue: 43000,
      status: "reserved",
      dateAdded: new Date(Date.now() - 86400000 * 3).toISOString(),
      custom: { Brand: "Dell", "RAM (GB)": 64, "Warranty ends": "2028-01-15" },
    },
    {
      categoryId: goats.id,
      name: "Dairy goat, Alpine",
      quantity: 6,
      lowStockThreshold: 10,
      location: "Pasture 3, Techiman",
      unitValue: 1250,
      status: "in-stock",
      dateAdded: new Date(Date.now() - 86400000 * 40).toISOString(),
      custom: { Breed: "Alpine", "Age (months)": 18, "Weight (kg)": 52 },
    },
  ];

  for (const s of seeds) await createItem(s);
}

/* ---------------- backup ---------------- */

export interface Snapshot {
  app: "northern-ledger";
  version: 1;
  exportedAt: string;
  categories: Category[];
  items: Item[];
  activity: Activity[];
  users?: User[];
}

export async function exportSnapshot(): Promise<Snapshot> {
  return {
    app: "northern-ledger",
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: await db().categories.toArray(),
    items: await db().items.toArray(),
    activity: await db().activity.toArray(),
    users: await db().users.toArray(),
  };
}

export async function importSnapshot(snap: Snapshot, mode: "replace" | "merge") {
  if (!snap || !Array.isArray(snap.categories) || !Array.isArray(snap.items)) {
    throw new Error("That file doesn't look like a Northern Ledger backup.");
  }
  const d = db();
  await d.transaction("rw", d.categories, d.items, d.activity, d.users, async () => {
    if (mode === "replace") {
      await Promise.all([d.categories.clear(), d.items.clear(), d.activity.clear(), d.users.clear()]);
    }
    await d.categories.bulkPut(snap.categories);
    await d.items.bulkPut(snap.items);
    if (Array.isArray(snap.activity)) await d.activity.bulkPut(snap.activity);
    if (Array.isArray(snap.users)) await d.users.bulkPut(snap.users);
  });
  await ensureDefaultAdmin();
  await log({
    kind: "data-imported",
    message: `Imported backup (${snap.items.length} items, ${snap.categories.length} categories)`,
  });
}

export async function clearAll() {
  const d = db();
  await Promise.all([d.categories.clear(), d.items.clear(), d.activity.clear()]);
}
