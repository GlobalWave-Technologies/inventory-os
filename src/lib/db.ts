import Dexie, { type Table } from "dexie";
import { z } from "zod";

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
  deletedAt?: string;
}

export type UserRole = "admin" | "staff";

export interface User {
  id: string;
  name: string;
  email: string;
  /** Legacy plaintext password, migrated to passwordHash on the next successful login. */
  password?: string;
  passwordHash?: string;
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
  soldQuantity: number;
  lowStockThreshold: number;
  location: string;
  originalPrice: number;
  sellingPrice: number;
  status: ItemStatus;
  dateAdded: string;
  notes?: string;
  custom: Record<string, string | number>;
  updatedAt: string;
  deletedAt?: string;
}

export interface DailySalesLine {
  itemId: string;
  itemName: string;
  quantity: number;
  originalPrice: number;
  sellingPrice: number;
}

export interface DailySalesReport {
  id: string;
  reportDate: string;
  categoryId: string;
  submittedBy: string;
  submittedAt: string;
  lines: DailySalesLine[];
  totalUnits: number;
  revenue: number;
  cost: number;
  profit: number;
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
  reversedAt?: string;
  userId?: string;
  allowed?: boolean;
  at: string;
}

class LedgerDB extends Dexie {
  categories!: Table<Category, string>;
  items!: Table<Item, string>;
  activity!: Table<Activity, string>;
  users!: Table<User, string>;
  dailySalesReports!: Table<DailySalesReport, string>;

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
    // v3 adds soft-delete indexes. Keep prior fields optional so existing browser databases migrate safely.
    this.version(3).stores({
      categories: "id, name, createdAt, deletedAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt, deletedAt",
      activity: "id, at, kind, itemId",
      users: "id, &email, role, createdAt",
    });
    this.version(4).stores({
      categories: "id, name, createdAt, deletedAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt, deletedAt",
      activity: "id, at, kind, itemId",
      users: "id, &email, role, createdAt",
    }).upgrade((tx) =>
      tx.table("items").toCollection().modify((item: Item & { unitValue?: number }) => {
        item.originalPrice ??= item.unitValue ?? 0;
        item.sellingPrice ??= item.unitValue ?? 0;
        delete item.unitValue;
      }),
    );
    this.version(5).stores({
      categories: "id, name, createdAt, deletedAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt, deletedAt",
      activity: "id, at, kind, itemId",
      users: "id, &email, role, createdAt",
    }).upgrade((tx) =>
      tx.table("items").toCollection().modify((item: Item) => {
        item.soldQuantity ??= 0;
      }),
    );
    this.version(6).stores({
      categories: "id, name, createdAt, deletedAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt, deletedAt",
      activity: "id, at, kind, itemId",
      users: "id, &email, role, createdAt",
    }).upgrade((tx) =>
      tx.table("users").toCollection().modify((user: User) => {
        if (user.role === "staff") user.categoryIds = user.categoryIds.slice(0, 1);
      }),
    );
    this.version(7).stores({
      categories: "id, name, createdAt, deletedAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt, deletedAt",
      activity: "id, at, kind, itemId",
      users: "id, &email, role, createdAt",
      dailySalesReports: "id, reportDate, categoryId, submittedBy, submittedAt",
    });
    this.version(8).stores({
      categories: "id, name, createdAt, deletedAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt, deletedAt",
      activity: "id, at, kind, itemId",
      users: "id, &email, role, createdAt",
      dailySalesReports: "id, reportDate, categoryId, submittedBy, submittedAt",
    }).upgrade(async (tx) => {
      const demo = await tx.table("users").where("email").equals("staff@veridian.local").first();
      if (!demo) return;
      await tx.table("dailySalesReports").toCollection().filter((report: DailySalesReport) => report.submittedBy === demo.id).delete();
      await tx.table("users").delete(demo.id);
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

function currentUserId() {
  try {
    const session = JSON.parse(localStorage.getItem("veridian-session") ?? "null") as { userId?: string; expiresAt?: number } | null;
    return session?.expiresAt && session.expiresAt > Date.now() ? session.userId : undefined;
  } catch {
    return undefined;
  }
}

async function log(entry: Omit<Activity, "id" | "at">) {
  await db().activity.add({ ...entry, userId: entry.userId ?? currentUserId(), id: uid(), at: new Date().toISOString() });
}

async function assertPortalAccess(categoryId: string) {
  const raw = localStorage.getItem("veridian-session");
  if (!raw) return; // Initial local seed runs before a user session exists.
  const session = JSON.parse(raw) as { userId?: string; expiresAt?: number; portalId?: string };
  const user = session.userId ? await db().users.get(session.userId) : undefined;
  const allowed = !!user && session.expiresAt && session.expiresAt > Date.now() && (user.role === "admin" || (session.portalId === categoryId && user.categoryIds.includes(categoryId)));
  if (!allowed) {
    if (user) await logPortalAccess(user.id, categoryId, false);
    throw new Error("You do not have access to this portal.");
  }
}

const categorySchema = z.object({ name: z.string().trim().min(1).max(80), accent: z.enum(["a", "b", "c", "amber", "rose"]), attributes: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(80), type: z.enum(["text", "number", "date", "select"]), options: z.array(z.string()).optional(), required: z.boolean().optional() })).max(30) });
const itemSchema = z.object({ categoryId: z.string().min(1), name: z.string().trim().min(1).max(160), quantity: z.number().finite().min(0), soldQuantity: z.number().finite().min(0).default(0), lowStockThreshold: z.number().finite().min(0), location: z.string().max(160), originalPrice: z.number().finite().min(0), sellingPrice: z.number().finite().min(0), status: z.enum(["in-stock", "reserved", "damaged", "archived"]), dateAdded: z.string().datetime(), notes: z.string().max(3000).optional(), custom: z.record(z.union([z.string().max(500), z.number().finite()])) });
const emailSchema = z.string().trim().toLowerCase().email().max(254);

function normalizeEmail(email: string) {
  return emailSchema.parse(email);
}

async function passwordDigest(password: string) {
  const bytes = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/* ---------------- users & access ---------------- */

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;
const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 6;
const MFA_CODE_LENGTH = 6;

function isStrongPassword(password: string) {
  return PASSWORD_POLICY.test(password);
}

function getLoginAttemptsKey(email: string) {
  return `stockline-login-attempts:${email.trim().toLowerCase()}`;
}

function readLoginAttempts(email: string) {
  try {
    const raw = localStorage.getItem(getLoginAttemptsKey(email));
    if (!raw) return { count: 0, windowStart: Date.now() };
    const parsed = JSON.parse(raw) as { count: number; windowStart: number };
    if (parsed.windowStart + LOGIN_RATE_LIMIT_WINDOW_MS < Date.now()) {
      localStorage.removeItem(getLoginAttemptsKey(email));
      return { count: 0, windowStart: Date.now() };
    }
    return parsed;
  } catch {
    localStorage.removeItem(getLoginAttemptsKey(email));
    return { count: 0, windowStart: Date.now() };
  }
}

function recordLoginFailure(email: string) {
  const attempts = readLoginAttempts(email);
  const next = { count: attempts.count + 1, windowStart: attempts.windowStart };
  localStorage.setItem(getLoginAttemptsKey(email), JSON.stringify(next));
  return next.count;
}

function clearLoginFailures(email: string) {
  localStorage.removeItem(getLoginAttemptsKey(email));
}

function getMfaChallenge(email: string) {
  const challengeId = `${email.toLowerCase()}-${Date.now()}`;
  const code = `${Math.floor(100000 + Math.random() * 900000)}`;
  sessionStorage.setItem(`stockline-mfa:${challengeId}`, code);
  return { challengeId, code };
}

export async function ensureDefaultAdmin() {
  const existing = await db().users.where("email").equals("admin@veridian.local").first();
  if (existing) return existing;
  const admin: User = {
    id: uid(),
    name: "Administrator",
    email: "admin@veridian.local",
    passwordHash: await passwordDigest("Admin123!"),
    role: "admin",
    categoryIds: [],
    createdAt: new Date().toISOString(),
  };
  await db().users.add(admin);
  return admin;
}

export async function removeDemoStaff() {
  const demo = await db().users.where("email").equals("staff@veridian.local").first();
  if (demo) await db().users.delete(demo.id);
}

export async function authenticate(email: string, password: string, role?: User["role"], otpCode?: string) {
  const normalizedEmail = normalizeEmail(email);
  const attempts = readLoginAttempts(normalizedEmail);
  if (attempts.count >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    throw new Error("Too many attempts. Please wait a few minutes before trying again.");
  }

  const user = await db().users.where("email").equals(normalizedEmail).first();
  if (!user) {
    recordLoginFailure(normalizedEmail);
    return null;
  }

  if (role && user.role !== role) {
    recordLoginFailure(normalizedEmail);
    return null;
  }

  const accepted = user.passwordHash ? user.passwordHash === await passwordDigest(password) : user.password === password;
  if (!accepted) {
    recordLoginFailure(normalizedEmail);
    return null;
  }

  clearLoginFailures(normalizedEmail);

  if (user.role === "admin" || user.role === "staff") {
    const mfaChallenge = getMfaChallenge(normalizedEmail);
    const code = otpCode ?? "";
    const validOtp = code.length === MFA_CODE_LENGTH && sessionStorage.getItem(`stockline-mfa:${mfaChallenge.challengeId}`) === code;
    if (!otpCode) {
      return { ...user, requiresMfa: true, challengeId: mfaChallenge.challengeId };
    }
    if (!validOtp) {
      throw new Error("Invalid verification code.");
    }
    sessionStorage.removeItem(`stockline-mfa:${mfaChallenge.challengeId}`);
  }

  if (!user.passwordHash) {
    const passwordHash = await passwordDigest(password);
    await db().users.update(user.id, { passwordHash, password: undefined });
    return { ...user, passwordHash, password: undefined };
  }
  return user;
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  if (!isStrongPassword(input.password)) {
    throw new Error("Password must be at least 12 characters and include upper/lowercase, a number, and a symbol.");
  }
  const existing = await db().users.where("email").equals(email).first();
  if (existing) throw new Error("An account with this email already exists.");

  const user: User = {
    id: uid(),
    name: input.name.trim(),
    email,
    passwordHash: await passwordDigest(input.password),
    role: "staff",
    categoryIds: [],
    createdAt: new Date().toISOString(),
  };
  await db().users.add(user);
  return user;
}

export async function resetPassword(email: string, password: string) {
  if (!isStrongPassword(password)) return false;
  const user = await db().users.where("email").equals(normalizeEmail(email)).first();
  if (!user) return false;
  await db().users.update(user.id, { passwordHash: await passwordDigest(password), password: undefined });
  return true;
}

export async function changePassword(userId: string, currentPassword: string, nextPassword: string) {
  const user = await db().users.get(userId);
  if (!user || !isStrongPassword(nextPassword)) return false;
  const currentHash = await passwordDigest(currentPassword);
  const matches = user.passwordHash ? user.passwordHash === currentHash : user.password === currentPassword;
  if (!matches) return false;
  await db().users.update(userId, { passwordHash: await passwordDigest(nextPassword), password: undefined });
  return true;
}

export async function getUser(id: string) {
  return db().users.get(id);
}

export async function listUsers() {
  return db().users.orderBy("createdAt").toArray();
}

export async function createStaff(input: { name: string; email: string; password: string; categoryIds: string[] }) {
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
  const categoryIds = input.categoryIds.slice(0, 1);
  const user: User = {
    id: uid(),
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    passwordHash: await passwordDigest(input.password),
    role: "staff",
    categoryIds,
    createdAt: new Date().toISOString(),
  };
  await db().users.add(user);
  return user;
}

export async function updateStaff(id: string, patch: Partial<{ name: string; email: string; password: string; categoryIds: string[] }>) {
  const { password, ...safePatch } = patch;
  if (password && password.length < 8) throw new Error("Password must be at least 8 characters.");
  const email = safePatch.email ? normalizeEmail(safePatch.email) : undefined;
  const categoryIds = safePatch.categoryIds?.slice(0, 1);
  await db().users.update(id, {
    ...safePatch,
    ...(email ? { email } : {}),
    ...(categoryIds ? { categoryIds } : {}),
    ...(password ? { passwordHash: await passwordDigest(password), password: undefined } : {}),
  });
}

export async function deleteStaff(id: string) {
  const user = await db().users.get(id);
  if (user?.role === "admin") throw new Error("The administrator account cannot be deleted.");
  await db().users.delete(id);
}

/* ---------------- categories ---------------- */

export async function listCategories() {
  return db().categories.filter((category) => !category.deletedAt).toArray();
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
  const d = db();
  await d.transaction("rw", d.categories, d.items, d.activity, async () => {
    const current = await d.categories.get(id);
    if (!current || current.deletedAt) return;
    const at = new Date().toISOString();
    await d.categories.update(id, { deletedAt: at });
    await d.items.where("categoryId").equals(id).modify({ deletedAt: at, status: "archived", updatedAt: at });
    await d.activity.add({ id: uid(), at, kind: "category-deleted", message: `Archived category ${current.name}`, categoryId: id, userId: currentUserId(), reason: "Category archived" });
  });
  return;
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
  return db().items.filter((item) => !item.deletedAt).toArray();
}

export async function listDailySalesReports() {
  return db().dailySalesReports.orderBy("reportDate").reverse().toArray();
}

export async function submitDailySalesReport(input: {
  reportDate: string;
  categoryId: string;
  submittedBy: string;
  lines: DailySalesLine[];
}) {
  await assertPortalAccess(input.categoryId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.reportDate) || input.lines.length === 0) {
    throw new Error("A report date and at least one sold item are required.");
  }
  const d = db();
  const existing = await d.dailySalesReports
    .where("reportDate").equals(input.reportDate)
    .filter((report) => report.categoryId === input.categoryId && report.submittedBy === input.submittedBy)
    .first();
  if (existing) throw new Error("You already submitted a report for this category and date.");
  const lines = input.lines.map((line) => ({
    ...line,
    quantity: Math.max(0, Math.floor(line.quantity)),
    originalPrice: Math.max(0, line.originalPrice),
    sellingPrice: Math.max(0, line.sellingPrice),
  })).filter((line) => line.quantity > 0);
  if (lines.length === 0) throw new Error("Enter at least one sold quantity.");
  const report: DailySalesReport = {
    id: uid(),
    reportDate: input.reportDate,
    categoryId: input.categoryId,
    submittedBy: input.submittedBy,
    submittedAt: new Date().toISOString(),
    lines,
    totalUnits: lines.reduce((sum, line) => sum + line.quantity, 0),
    revenue: lines.reduce((sum, line) => sum + line.quantity * line.sellingPrice, 0),
    cost: lines.reduce((sum, line) => sum + line.quantity * line.originalPrice, 0),
    profit: lines.reduce((sum, line) => sum + line.quantity * (line.sellingPrice - line.originalPrice), 0),
  };
  await d.transaction("rw", d.dailySalesReports, d.activity, async () => {
    await d.dailySalesReports.add(report);
    await d.activity.add({ id: uid(), at: report.submittedAt, kind: "item-updated", message: `Submitted daily sales report for ${input.reportDate}`, categoryId: input.categoryId, userId: input.submittedBy, reason: "Immutable daily sales report" });
  });
  return report;
}

export async function createItem(
  input: Omit<Item, "id" | "updatedAt" | "dateAdded"> & { dateAdded?: string },
): Promise<Item> {
  await assertPortalAccess(input.categoryId);
  const now = new Date().toISOString();
  const item = itemSchema.parse({
    ...input,
    dateAdded: input.dateAdded || now,
    id: uid(),
    updatedAt: now,
  }) as Item;
  (item as Item).id = uid();
  (item as Item).updatedAt = now;
  const d = db();
  await d.transaction("rw", d.items, d.activity, async () => {
    await d.items.add(item);
    await d.activity.add({ id: uid(), at: now, kind: "item-created", message: `Added ${item.name} (${item.quantity} in stock)`, itemId: item.id, categoryId: item.categoryId, userId: currentUserId(), delta: item.quantity });
  });
  return item;
}

export async function logPortalAccess(userId: string, categoryId: string, allowed: boolean) {
  await db().activity.add({ id: uid(), at: new Date().toISOString(), kind: "item-updated", message: allowed ? "Portal access granted" : "Unauthorized portal access blocked", userId, categoryId, allowed, reason: "Portal selection" });
}

export async function updateItem(id: string, patch: Partial<Item>) {
  const before = await db().items.get(id);
  if (before) await assertPortalAccess(before.categoryId);
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
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Stock adjustment must be a non-zero number.");
  if (!reason.trim()) throw new Error("A reason is required for every stock adjustment.");
  const d = db();
  const target = await d.items.get(id);
  if (target) await assertPortalAccess(target.categoryId);
  await d.transaction("rw", d.items, d.activity, async () => {
    const current = await d.items.get(id);
    if (!current || current.deletedAt) throw new Error("Item not found.");
    const next = Math.max(0, current.quantity + delta);
    const at = new Date().toISOString();
    await d.items.update(id, { quantity: next, updatedAt: at });
    await d.activity.add({ id: uid(), at, kind: "stock-adjusted", message: `${current.name}: ${current.quantity} to ${next}`, itemId: id, categoryId: current.categoryId, userId: currentUserId(), delta: next - current.quantity, reason: reason.trim() });
  });
  return;
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
  const d = db();
  const target = await d.items.get(id);
  if (target) await assertPortalAccess(target.categoryId);
  await d.transaction("rw", d.items, d.activity, async () => {
    const current = await d.items.get(id);
    if (!current || current.deletedAt) return;
    const at = new Date().toISOString();
    await d.items.update(id, { deletedAt: at, status: "archived", updatedAt: at });
    await d.activity.add({ id: uid(), at, kind: "item-deleted", message: `Archived ${current.name}`, itemId: id, categoryId: current.categoryId, userId: currentUserId(), reason: "Item archived" });
  });
  return;
  const item = await db().items.get(id);
  await db().items.delete(id);
  if (item) {
    await log({ kind: "item-deleted", message: `Deleted ${item.name}`, categoryId: item.categoryId });
  }
}

/** Reverses an adjustment only while it is still the most recent stock change for that item. */
export async function undoStockAdjustment(activityId: string) {
  const d = db();
  return d.transaction("rw", d.items, d.activity, async () => {
    const adjustment = await d.activity.get(activityId);
    if (!adjustment?.itemId || adjustment.kind !== "stock-adjusted" || adjustment.reversedAt || !adjustment.delta) return false;
    const latest = (await d.activity.where("itemId").equals(adjustment.itemId).toArray()).sort((a, b) => b.at.localeCompare(a.at))[0];
    if (latest?.id !== activityId) throw new Error("Only the latest stock change can be undone.");
    const item = await d.items.get(adjustment.itemId);
    if (!item || item.deletedAt) return false;
    const next = Math.max(0, item.quantity - adjustment.delta);
    const at = new Date().toISOString();
    await d.items.update(item.id, { quantity: next, updatedAt: at });
    await d.activity.update(activityId, { reversedAt: at });
    await d.activity.add({ id: uid(), at, kind: "stock-adjusted", message: `${item.name}: undid previous adjustment`, itemId: item.id, categoryId: item.categoryId, userId: currentUserId(), delta: next - item.quantity, reason: "Undo last adjustment" });
    return true;
  });
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
  if (count > 0) {
    return;
  }

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
      originalPrice: 2150,
      sellingPrice: 2750,
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
      originalPrice: 340,
      sellingPrice: 475,
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
      originalPrice: 18990,
      sellingPrice: 22400,
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
      originalPrice: 43000,
      sellingPrice: 49500,
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
      originalPrice: 1250,
      sellingPrice: 1650,
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
  const items = snap.items.map((item) => {
    const legacy = item as Item & { unitValue?: number };
    const originalPrice = legacy.originalPrice ?? legacy.unitValue ?? 0;
    const sellingPrice = legacy.sellingPrice ?? legacy.unitValue ?? originalPrice;
    return { ...item, originalPrice, sellingPrice, soldQuantity: item.soldQuantity ?? 0 };
  });
  await d.transaction("rw", d.categories, d.items, d.activity, d.users, async () => {
    if (mode === "replace") {
      await Promise.all([d.categories.clear(), d.items.clear(), d.activity.clear(), d.users.clear()]);
    }
    await d.categories.bulkPut(snap.categories);
    await d.items.bulkPut(items);
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
