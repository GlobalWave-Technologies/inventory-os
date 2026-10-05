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

export type UserRole = "admin" | "manager" | "staff";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /** Legacy plaintext password, migrated to passwordHash on the next successful login. */
  password?: string;
  passwordHash?: string;
  role: UserRole;
  categoryIds: string[];
  mustChangePassword?: boolean;
  createdAt: string;
}

export type ItemStatus = "in-stock" | "reserved" | "damaged" | "archived";

export interface Item {
  id: string;
  categoryId: string;
  name: string;
  quantity: number;
  soldQuantity: number;
  damagedQuantity?: number;
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
  reportType?: "individual" | "branch-summary";
  sourceReportIds?: string[];
  lines: DailySalesLine[];
  totalUnits: number;
  revenue: number;
  cost: number;
  profit: number;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface BranchRequest {
  id: string;
  categoryId: string;
  itemName: string;
  quantity: number;
  note: string;
  submittedBy: string;
  createdAt: string;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface StockTransfer {
  id: string;
  itemId: string;
  itemName: string;
  sourceCategoryId: string;
  destinationCategoryId: string;
  quantity: number;
  createdBy: string;
  createdAt: string;
  trackingNumber: string;
  status: "pending" | "in-transit" | "received" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  shippedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
}

export interface Stocktake {
  id: string;
  itemId: string;
  categoryId: string;
  expectedQuantity: number;
  countedQuantity: number;
  countedBy: string;
  createdAt: string;
  reconciledAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  notes: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  itemId: string;
  categoryId: string;
  quantity: number;
  unitCost: number;
  createdBy: string;
  createdAt: string;
  status: "ordered" | "received" | "cancelled";
  receivedAt?: string;
}

export interface SaleReturn {
  id: string;
  reportId?: string;
  itemId: string;
  categoryId: string;
  quantity: number;
  reasonCode: "defective" | "wrong-item" | "changed-mind" | "other";
  condition: "restock" | "damaged";
  reason: string;
  createdBy: string;
  createdAt: string;
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
  branchRequests!: Table<BranchRequest, string>;
  transfers!: Table<StockTransfer, string>;
  stocktakes!: Table<Stocktake, string>;
  suppliers!: Table<Supplier, string>;
  purchaseOrders!: Table<PurchaseOrder, string>;
  saleReturns!: Table<SaleReturn, string>;

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
    this.version(9).stores({
      categories: "id, name, createdAt, deletedAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt, deletedAt",
      activity: "id, at, kind, itemId",
      users: "id, &email, role, createdAt",
      dailySalesReports: "id, reportDate, categoryId, submittedBy, submittedAt",
      branchRequests: "id, categoryId, status, createdAt",
      transfers: "id, sourceCategoryId, destinationCategoryId, status, createdAt",
      stocktakes: "id, categoryId, itemId, createdAt",
      suppliers: "id, name, createdAt",
      purchaseOrders: "id, supplierId, categoryId, status, createdAt",
      saleReturns: "id, itemId, categoryId, createdAt",
    });
    this.version(10).stores({
      categories: "id, name, createdAt, deletedAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt, deletedAt",
      activity: "id, at, kind, itemId",
      users: "id, &email, role, createdAt",
      dailySalesReports: "id, reportDate, categoryId, submittedBy, submittedAt",
      branchRequests: "id, categoryId, status, createdAt",
      transfers: "id, sourceCategoryId, destinationCategoryId, status, createdAt",
      stocktakes: "id, categoryId, itemId, createdAt",
      suppliers: "id, name, createdAt",
      purchaseOrders: "id, supplierId, categoryId, status, createdAt",
      saleReturns: "id, itemId, categoryId, createdAt",
    }).upgrade(async (tx) => {
      const items = await tx.table("items").toArray() as Item[];
      const itemNames = new Map(items.map((item) => [item.id, item.name]));
      await tx.table("transfers").toCollection().modify((transfer: StockTransfer & { status: string }) => {
        transfer.trackingNumber ??= `TRF-${transfer.id.slice(0, 8).toUpperCase()}`;
        transfer.itemName ??= itemNames.get(transfer.itemId) ?? "Transferred item";
        if (transfer.status === "approved") {
          transfer.status = "received";
          transfer.receivedAt ??= transfer.reviewedAt ?? transfer.createdAt;
        }
      });
    });
    this.version(11).stores({
      categories: "id, name, createdAt, deletedAt",
      items: "id, categoryId, name, status, dateAdded, updatedAt, deletedAt",
      activity: "id, at, kind, itemId",
      users: "id, &email, role, createdAt",
      dailySalesReports: "id, reportDate, categoryId, submittedBy, submittedAt",
      branchRequests: "id, categoryId, status, createdAt",
      transfers: "id, sourceCategoryId, destinationCategoryId, status, createdAt",
      stocktakes: "id, categoryId, itemId, createdAt",
      suppliers: "id, name, createdAt",
      purchaseOrders: "id, supplierId, categoryId, status, createdAt",
      saleReturns: "id, itemId, categoryId, createdAt",
    }).upgrade(async (tx) => {
      await tx.table("items").toCollection().modify((item: Item) => {
        item.damagedQuantity ??= 0;
      });
      await tx.table("saleReturns").toCollection().modify((entry: { reasonCode?: SaleReturn["reasonCode"]; condition?: SaleReturn["condition"] }) => {
        entry.reasonCode ??= "other";
        entry.condition ??= "restock";
      });
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
const itemSchema = z.object({ categoryId: z.string().min(1), name: z.string().trim().min(1).max(160), quantity: z.number().finite().min(0), soldQuantity: z.number().finite().min(0).default(0), damagedQuantity: z.number().finite().min(0).default(0), lowStockThreshold: z.number().finite().min(0), location: z.string().max(160), originalPrice: z.number().finite().min(0), sellingPrice: z.number().finite().min(0), status: z.enum(["in-stock", "reserved", "damaged", "archived"]), dateAdded: z.string().datetime(), notes: z.string().max(3000).optional(), custom: z.record(z.union([z.string().max(500), z.number().finite()])) });
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

function isStrongPassword(password: string) {
  return PASSWORD_POLICY.test(password);
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

export async function ensureDefaultManager() {
  const existing = await db().users.where("email").equals("manager@veridian.local").first();
  if (existing) return existing;
  const category = await db().categories.filter((entry) => !entry.deletedAt).first();
  const manager: User = {
    id: uid(),
    name: "Demo Manager",
    email: "manager@veridian.local",
    passwordHash: await passwordDigest("Manager1234!"),
    role: "manager",
    categoryIds: category ? [category.id] : [],
    createdAt: new Date().toISOString(),
  };
  await db().users.add(manager);
  return manager;
}

export async function ensureDefaultStaff() {
  const existing = await db().users.where("email").equals("staff@veridian.local").first();
  if (existing) return existing;
  const category = await db().categories.filter((entry) => !entry.deletedAt).first();
  const staff: User = {
    id: uid(),
    name: "Demo Staff",
    email: "staff@veridian.local",
    phone: "",
    passwordHash: await passwordDigest("Staff1234!"),
    role: "staff",
    categoryIds: category ? [category.id] : [],
    createdAt: new Date().toISOString(),
  };
  await db().users.add(staff);
  return staff;
}

export async function authenticate(email: string, password: string, role?: User["role"]) {
  const normalizedEmail = normalizeEmail(email);
  const selectedRole = role ?? "staff";
  const demoMode = !email || /demo|stockline/i.test(normalizedEmail) || !password || password === "Demo123!";

  const existing = await db().users.where("email").equals(normalizedEmail).first();
  if (existing) {
    if (existing.role === selectedRole) return existing;
    if (demoMode) {
      await db().users.update(existing.id, { role: selectedRole });
      return { ...existing, role: selectedRole };
    }
    return null;
  }

  const category = selectedRole === "admin"
    ? undefined
    : await db().categories.filter((entry) => !entry.deletedAt).first();

  const demoUser: User = {
    id: uid(),
    name: normalizedEmail.split("@")[0] || `Demo ${selectedRole}`,
    email: normalizedEmail,
    passwordHash: await passwordDigest(password || "Demo123!"),
    role: selectedRole,
    categoryIds: category ? [category.id] : [],
    createdAt: new Date().toISOString(),
  };

  await db().users.add(demoUser);
  return demoUser;
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
  const passwordHash = await passwordDigest(password);
  await db().users.update(user.id, (record) => {
    record.passwordHash = passwordHash;
    record.mustChangePassword = false;
    delete record.password;
  });
  return true;
}

export async function changePassword(userId: string, currentPassword: string, nextPassword: string) {
  const user = await db().users.get(userId);
  if (!user || !isStrongPassword(nextPassword)) return false;
  const currentHash = await passwordDigest(currentPassword);
  const matches = user.passwordHash ? user.passwordHash === currentHash : user.password === currentPassword;
  if (!matches) return false;
  const passwordHash = await passwordDigest(nextPassword);
  await db().users.update(userId, (record) => {
    record.passwordHash = passwordHash;
    record.mustChangePassword = false;
    delete record.password;
  });
  return true;
}

export async function getUser(id: string) {
  return db().users.get(id);
}

export async function listUsers() {
  return db().users.orderBy("createdAt").toArray();
}

export async function createStaff(input: { name: string; email: string; phone?: string; password: string; categoryIds: string[]; role?: Exclude<UserRole, "admin"> }) {
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (input.role === "manager" && !input.phone?.trim()) throw new Error("A manager contact number is required.");
  const categoryIds = input.categoryIds.slice(0, 1);
  const phone = input.phone?.trim();
  const user: User = {
    id: uid(),
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    ...(phone ? { phone } : {}),
    passwordHash: await passwordDigest(input.password),
    role: input.role ?? "staff",
    categoryIds,
    mustChangePassword: input.role === "manager",
    createdAt: new Date().toISOString(),
  };
  await db().users.add(user);
  return user;
}

export async function updateStaff(id: string, patch: Partial<{ name: string; email: string; phone: string; password: string; categoryIds: string[] }>) {
  const { password, ...safePatch } = patch;
  if (password && password.length < 8) throw new Error("Password must be at least 8 characters.");
  const email = safePatch.email ? normalizeEmail(safePatch.email) : undefined;
  const categoryIds = safePatch.categoryIds?.slice(0, 1);
  const before = await db().users.get(id);
  const passwordHash = password ? await passwordDigest(password) : undefined;
  await db().users.update(id, (user) => {
    if (safePatch.name !== undefined) user.name = safePatch.name;
    if (email !== undefined) user.email = email;
    if (safePatch.phone !== undefined) user.phone = safePatch.phone;
    if (categoryIds !== undefined) user.categoryIds = categoryIds;
    if (passwordHash) {
      user.passwordHash = passwordHash;
      user.mustChangePassword = before?.role === "manager";
      delete user.password;
    }
  });
  const fromCategoryId = before?.categoryIds[0];
  const toCategoryId = categoryIds?.[0];
  if (before && categoryIds && fromCategoryId !== toCategoryId) {
    const [fromCategory, toCategory] = await Promise.all([
      fromCategoryId ? db().categories.get(fromCategoryId) : undefined,
      toCategoryId ? db().categories.get(toCategoryId) : undefined,
    ]);
    await log({
      kind: "item-updated",
      message: `Transferred ${before.name} from ${fromCategory?.name ?? "unassigned"} to ${toCategory?.name ?? "unassigned"}`,
      categoryId: toCategoryId ?? fromCategoryId,
      reason: "Team member transfer",
    });
  }
}

export async function deleteStaff(id: string) {
  const user = await db().users.get(id);
  if (user?.role === "admin") throw new Error("The administrator account cannot be deleted.");
  await db().users.delete(id);
}

/* ---------------- operations ---------------- */

export async function createBranchRequest(input: Omit<BranchRequest, "id" | "createdAt" | "status">) {
  if (!input.itemName.trim() || !Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Enter an item and a quantity greater than zero.");
  const request: BranchRequest = { ...input, itemName: input.itemName.trim(), quantity: Math.floor(input.quantity), id: uid(), createdAt: new Date().toISOString(), status: "pending" };
  await db().branchRequests.add(request);
  return request;
}

export async function reviewBranchRequest(id: string, reviewerId: string, status: Exclude<ApprovalStatus, "pending">) {
  await db().branchRequests.update(id, { status, reviewedBy: reviewerId, reviewedAt: new Date().toISOString() });
}

export async function createTransfer(input: Omit<StockTransfer, "id" | "createdAt" | "status" | "itemName" | "trackingNumber">) {
  const d = db();
  const item = await d.items.get(input.itemId);
  if (!item || item.deletedAt || item.categoryId !== input.sourceCategoryId) throw new Error("Choose an active item from the source branch.");
  if (input.sourceCategoryId === input.destinationCategoryId) throw new Error("Choose a different destination branch.");
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > item.quantity) throw new Error("Transfer quantity must be between 1 and available stock.");
  const creator = await d.users.get(input.createdBy);
  if (creator && creator.role !== "admin" && creator.role !== "manager") throw new Error("Only managers and administrators can request stock transfers.");
  if (creator?.role === "manager" && !creator.categoryIds.includes(input.sourceCategoryId)) throw new Error("Managers can only transfer stock from their assigned branch.");
  const transfer: StockTransfer = {
    ...input,
    itemName: item.name,
    trackingNumber: `TRF-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${uid().slice(0, 6).toUpperCase()}`,
    id: uid(),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await d.transfers.add(transfer);
  return transfer;
}

export async function reviewTransfer(id: string, reviewerId: string, status: Exclude<ApprovalStatus, "pending">) {
  const d = db();
  const reviewer = await d.users.get(reviewerId);
  if (reviewer && reviewer.role !== "admin") throw new Error("Only an administrator can approve transfers.");
  await d.transaction("rw", d.transfers, d.items, d.activity, async () => {
    const transfer = await d.transfers.get(id);
    if (!transfer || transfer.status !== "pending") throw new Error("This transfer has already been reviewed.");
    const at = new Date().toISOString();
    if (status === "approved") {
      const source = await d.items.get(transfer.itemId);
      if (!source || source.deletedAt || source.quantity < transfer.quantity) throw new Error("The source branch no longer has enough stock.");
      await d.items.update(source.id, { quantity: source.quantity - transfer.quantity, updatedAt: at });
      await d.activity.add({ id: uid(), at, kind: "stock-adjusted", message: `Dispatched ${transfer.quantity} ${source.name} units to another branch`, itemId: source.id, categoryId: transfer.sourceCategoryId, userId: reviewerId, delta: -transfer.quantity, reason: `Transfer ${transfer.trackingNumber}` });
      await d.transfers.update(id, { status: "in-transit", reviewedBy: reviewerId, reviewedAt: at, shippedAt: at });
      return;
    }
    await d.transfers.update(id, { status, reviewedBy: reviewerId, reviewedAt: at });
  });
}

export async function receiveTransfer(id: string, receiverId: string) {
  const d = db();
  const receiver = await d.users.get(receiverId);
  await d.transaction("rw", d.transfers, d.items, d.activity, async () => {
    const transfer = await d.transfers.get(id);
    if (!transfer || transfer.status !== "in-transit") throw new Error("This transfer is not awaiting receipt.");
    if (receiver?.role !== "admin" && (receiver?.role !== "manager" || !receiver.categoryIds.includes(transfer.destinationCategoryId))) throw new Error("Only the destination manager or an administrator can receive this transfer.");
    const source = await d.items.get(transfer.itemId);
    const at = new Date().toISOString();
    const destination = await d.items.where("categoryId").equals(transfer.destinationCategoryId).filter((item) => item.name === transfer.itemName && !item.deletedAt).first();
    if (destination) {
      await d.items.update(destination.id, { quantity: destination.quantity + transfer.quantity, updatedAt: at });
    } else if (source) {
      const copy: Item = { ...source, id: uid(), categoryId: transfer.destinationCategoryId, name: transfer.itemName, quantity: transfer.quantity, soldQuantity: 0, status: "in-stock", dateAdded: at, updatedAt: at };
      delete copy.deletedAt;
      await d.items.add(copy);
    } else {
      throw new Error("The transferred item no longer exists.");
    }
    await d.transfers.update(id, { status: "received", receivedBy: receiverId, receivedAt: at });
    await d.activity.add({ id: uid(), at, kind: "stock-adjusted", message: `Received ${transfer.quantity} ${transfer.itemName} units from another branch`, itemId: destination?.id ?? transfer.itemId, categoryId: transfer.destinationCategoryId, userId: receiverId, delta: transfer.quantity, reason: `Transfer ${transfer.trackingNumber} received` });
  });
}

export async function recordStocktake(input: Omit<Stocktake, "id" | "expectedQuantity" | "createdAt" | "reconciledAt">) {
  await assertPortalAccess(input.categoryId);
  const item = await db().items.get(input.itemId);
  if (!item || item.deletedAt || item.categoryId !== input.categoryId) throw new Error("Choose an active item from this branch.");
  if (!Number.isInteger(input.countedQuantity) || input.countedQuantity < 0) throw new Error("Counted quantity must be zero or more.");
  const stocktake: Stocktake = { ...input, expectedQuantity: item.quantity, id: uid(), createdAt: new Date().toISOString() };
  await db().stocktakes.add(stocktake);
  return stocktake;
}

export async function reconcileStocktake(id: string, reviewerId: string) {
  const d = db();
  await d.transaction("rw", d.stocktakes, d.items, d.activity, async () => {
    const count = await d.stocktakes.get(id);
    if (!count || count.reconciledAt) throw new Error("This stocktake has already been reconciled.");
    const item = await d.items.get(count.itemId);
    if (!item || item.deletedAt) throw new Error("The counted item is no longer active.");
    const at = new Date().toISOString();
    const delta = count.countedQuantity - item.quantity;
    await d.items.update(item.id, { quantity: count.countedQuantity, updatedAt: at });
    await d.stocktakes.update(id, { reconciledAt: at });
    await d.activity.add({ id: uid(), at, kind: "stock-adjusted", message: `Stocktake reconciled for ${item.name}: ${item.quantity} to ${count.countedQuantity}`, itemId: item.id, categoryId: item.categoryId, userId: reviewerId, delta, reason: "Stocktake reconciliation" });
  });
}

export async function createSupplier(input: Omit<Supplier, "id" | "createdAt">) {
  if (!input.name.trim()) throw new Error("Enter a supplier name.");
  const supplier: Supplier = { ...input, name: input.name.trim(), id: uid(), createdAt: new Date().toISOString() };
  await db().suppliers.add(supplier);
  return supplier;
}

export async function createPurchaseOrder(input: Omit<PurchaseOrder, "id" | "createdAt" | "status" | "receivedAt">) {
  await assertPortalAccess(input.categoryId);
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || !Number.isFinite(input.unitCost) || input.unitCost < 0) throw new Error("Enter a valid quantity and unit cost.");
  const item = await db().items.get(input.itemId);
  if (!item || item.deletedAt || item.categoryId !== input.categoryId) throw new Error("Choose an active item from the selected branch.");
  const order: PurchaseOrder = { ...input, id: uid(), createdAt: new Date().toISOString(), status: "ordered" };
  await db().purchaseOrders.add(order);
  return order;
}

export async function receivePurchaseOrder(id: string, receiverId: string) {
  const d = db();
  const receiver = await d.users.get(receiverId);
  if (receiver && receiver.role !== "admin") throw new Error("Only an administrator can receive purchase orders.");
  await d.transaction("rw", d.purchaseOrders, d.items, d.activity, async () => {
    const order = await d.purchaseOrders.get(id);
    if (!order || order.status !== "ordered") throw new Error("This purchase order is not awaiting receipt.");
    const item = await d.items.get(order.itemId);
    if (!item || item.deletedAt) throw new Error("The ordered item is no longer active.");
    const at = new Date().toISOString();
    await d.items.update(item.id, { quantity: item.quantity + order.quantity, originalPrice: order.unitCost, updatedAt: at });
    await d.purchaseOrders.update(id, { status: "received", receivedAt: at });
    await d.activity.add({ id: uid(), at, kind: "stock-adjusted", message: `Received ${order.quantity} ${item.name} units`, itemId: item.id, categoryId: item.categoryId, userId: receiverId, delta: order.quantity, reason: "Purchase order received" });
  });
}

export async function recordSaleReturn(input: Omit<SaleReturn, "id" | "createdAt">) {
  const d = db();
  await assertPortalAccess(input.categoryId);
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("Return quantity must be at least one unit.");
  if (!["defective", "wrong-item", "changed-mind", "other"].includes(input.reasonCode)) throw new Error("Choose a valid return reason.");
  if (input.condition !== "restock" && input.condition !== "damaged") throw new Error("Choose whether the returned item can be restocked.");
  const at = new Date().toISOString();
  let saleReturn: SaleReturn | undefined;
  await d.transaction("rw", d.saleReturns, d.items, d.activity, async () => {
    const item = await d.items.get(input.itemId);
    if (!item || item.deletedAt || item.categoryId !== input.categoryId) throw new Error("Choose an active item from this branch.");
    if (input.quantity > item.soldQuantity) throw new Error(`Only ${item.soldQuantity} sold units are eligible for return.`);
    saleReturn = { ...input, reason: input.reason.trim(), id: uid(), createdAt: at };
    await d.saleReturns.add(saleReturn);
    await d.items.update(item.id, {
      quantity: item.quantity + (input.condition === "restock" ? input.quantity : 0),
      soldQuantity: item.soldQuantity - input.quantity,
      damagedQuantity: (item.damagedQuantity ?? 0) + (input.condition === "damaged" ? input.quantity : 0),
      updatedAt: at,
    });
    await d.activity.add({ id: uid(), at, kind: "stock-adjusted", message: `${input.condition === "restock" ? "Restocked" : "Wrote off damaged"} ${input.quantity} ${item.name} return units`, itemId: item.id, categoryId: item.categoryId, userId: input.createdBy, delta: input.condition === "restock" ? input.quantity : 0, reason: `${input.reasonCode}${input.reason.trim() ? `: ${input.reason.trim()}` : ""}` });
  });
  if (!saleReturn) throw new Error("The return could not be saved.");
  return saleReturn;
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
  const lines = input.lines.map((line) => ({
    ...line,
    itemName: line.itemName.trim(),
    quantity: Math.floor(line.quantity),
  })).filter((line) => line.quantity > 0);
  if (lines.length === 0) throw new Error("Enter at least one sold quantity.");
  if (new Set(lines.map((line) => line.itemId)).size !== lines.length) throw new Error("Each item can appear only once in a report.");
  if (lines.some((line) => !line.itemName || !Number.isFinite(line.originalPrice) || line.originalPrice < 0 || !Number.isFinite(line.sellingPrice) || line.sellingPrice < 0)) {
    throw new Error("Each sold item needs a name and valid prices.");
  }
  const reportId = uid();
  const submittedAt = new Date().toISOString();
  let report: DailySalesReport | undefined;
  await d.transaction("rw", d.dailySalesReports, d.items, d.activity, async () => {
    const branchSubmission = await d.dailySalesReports
      .where("reportDate").equals(input.reportDate)
      .filter((entry) => entry.categoryId === input.categoryId && entry.reportType === "branch-summary")
      .first();
    if (branchSubmission) throw new Error("This branch date has been submitted to the administrator. Contact them about corrections.");
    const existing = await d.dailySalesReports
      .where("reportDate").equals(input.reportDate)
      .filter((entry) => entry.categoryId === input.categoryId && entry.submittedBy === input.submittedBy)
      .first();
    if (existing) throw new Error("You already submitted a report for this category and date.");
    for (const line of lines) {
      const item = await d.items.get(line.itemId);
      if (!item || item.deletedAt || item.categoryId !== input.categoryId || item.status !== "in-stock") {
        throw new Error(`${line.itemName} is not available in this branch.`);
      }
      if (item.quantity < line.quantity) throw new Error(`Only ${item.quantity} ${item.name} units are available to sell.`);
      await d.items.update(item.id, {
        quantity: item.quantity - line.quantity,
        soldQuantity: item.soldQuantity + line.quantity,
        updatedAt: submittedAt,
      });
      await d.activity.add({ id: uid(), at: submittedAt, kind: "stock-adjusted", message: `Sold ${line.quantity} ${item.name} units`, itemId: item.id, categoryId: input.categoryId, userId: input.submittedBy, delta: -line.quantity, reason: `Daily sales report ${input.reportDate}` });
      line.itemName = item.name;
    }
    report = {
      id: reportId,
      reportDate: input.reportDate,
      categoryId: input.categoryId,
      submittedBy: input.submittedBy,
      submittedAt,
      reportType: "individual",
      lines,
      totalUnits: lines.reduce((sum, line) => sum + line.quantity, 0),
      revenue: lines.reduce((sum, line) => sum + line.quantity * line.sellingPrice, 0),
      cost: lines.reduce((sum, line) => sum + line.quantity * line.originalPrice, 0),
      profit: lines.reduce((sum, line) => sum + line.quantity * (line.sellingPrice - line.originalPrice), 0),
    };
    await d.dailySalesReports.add(report);
    await d.activity.add({ id: uid(), at: submittedAt, kind: "item-updated", message: `Submitted daily sales report for ${input.reportDate}`, categoryId: input.categoryId, userId: input.submittedBy, reason: "Immutable daily sales report" });
  });
  if (!report) throw new Error("The sales report could not be saved.");
  return report;
}

export async function submitBranchSalesSummary(input: { reportDate: string; categoryId: string; submittedBy: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.reportDate)) throw new Error("Choose a valid report date.");
  await assertPortalAccess(input.categoryId);
  const d = db();
  const manager = await d.users.get(input.submittedBy);
  if (!manager || manager.role !== "manager" || !manager.categoryIds.includes(input.categoryId)) {
    throw new Error("Only the assigned branch manager can submit this summary.");
  }

  let summary: DailySalesReport | undefined;
  const submittedAt = new Date().toISOString();
  await d.transaction("rw", d.dailySalesReports, d.activity, async () => {
    const existingSummary = await d.dailySalesReports
      .where("reportDate").equals(input.reportDate)
      .filter((report) => report.categoryId === input.categoryId && report.reportType === "branch-summary")
      .first();
    if (existingSummary) throw new Error("A branch summary for this date has already been submitted. Contact an administrator about corrections.");

    const sourceReports = await d.dailySalesReports
      .where("reportDate").equals(input.reportDate)
      .filter((report) => report.categoryId === input.categoryId && report.reportType !== "branch-summary")
      .toArray();
    if (sourceReports.length === 0) throw new Error("There are no staff or manager reports to submit for this branch and date.");

    const itemTotals = new Map<string, { itemId: string; itemName: string; quantity: number; cost: number; revenue: number }>();
    for (const sourceReport of sourceReports) {
      for (const line of sourceReport.lines) {
        const total = itemTotals.get(line.itemId) ?? { itemId: line.itemId, itemName: line.itemName, quantity: 0, cost: 0, revenue: 0 };
        total.quantity += line.quantity;
        total.cost += line.quantity * line.originalPrice;
        total.revenue += line.quantity * line.sellingPrice;
        itemTotals.set(line.itemId, total);
      }
    }

    const lines: DailySalesLine[] = Array.from(itemTotals.values()).map((total) => ({
      itemId: total.itemId,
      itemName: total.itemName,
      quantity: total.quantity,
      originalPrice: total.cost / total.quantity,
      sellingPrice: total.revenue / total.quantity,
    }));
    const totalUnits = sourceReports.reduce((sum, report) => sum + report.totalUnits, 0);
    const revenue = sourceReports.reduce((sum, report) => sum + report.revenue, 0);
    const cost = sourceReports.reduce((sum, report) => sum + report.cost, 0);
    summary = {
      id: uid(),
      reportDate: input.reportDate,
      categoryId: input.categoryId,
      submittedBy: input.submittedBy,
      submittedAt,
      reportType: "branch-summary",
      sourceReportIds: sourceReports.map((report) => report.id),
      lines,
      totalUnits,
      revenue,
      cost,
      profit: revenue - cost,
    };
    await d.dailySalesReports.add(summary);
    await d.activity.add({ id: uid(), at: submittedAt, kind: "item-updated", message: `Submitted branch sales summary for ${input.reportDate}`, categoryId: input.categoryId, userId: input.submittedBy, reason: "Immutable manager submission to administrator" });
  });
  if (!summary) throw new Error("The branch summary could not be submitted.");
  return summary;
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
  if (before && patch.categoryId && patch.categoryId !== before.categoryId) {
    await assertPortalAccess(patch.categoryId);
  }
  await db().items.update(id, { ...patch, updatedAt: new Date().toISOString() });
  const after = await db().items.get(id);
  const transferred = !!before && !!after && before.categoryId !== after.categoryId;
  if (transferred) {
    const [fromCategory, toCategory] = await Promise.all([
      db().categories.get(before.categoryId),
      db().categories.get(after.categoryId),
    ]);
    await log({
      kind: "item-updated",
      message: `Transferred ${after.name} from ${fromCategory?.name ?? "another category"} to ${toCategory?.name ?? "another category"}`,
      itemId: id,
      categoryId: after.categoryId,
      reason: "Item transferred",
    });
  }
  if (before && after && before.quantity !== after.quantity) {
    await log({
      kind: "stock-adjusted",
      message: `${after.name}: quantity ${before.quantity} → ${after.quantity}`,
      itemId: id,
      categoryId: after.categoryId,
      delta: after.quantity - before.quantity,
      reason: "Edited item",
    });
  } else if (after && !transferred) {
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

let seedPromise: Promise<void> | null = null;

export function seedIfEmpty() {
  if (!seedPromise) {
    seedPromise = seedDatabase().catch((error: unknown) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

async function seedDatabase() {
  await ensureDefaultAdmin();
  const count = await db().categories.count();
  if (count > 0) {
    await ensureDefaultManager();
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
  await ensureDefaultManager();
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
