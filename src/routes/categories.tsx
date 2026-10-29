import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Boxes, Package, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, GhostButton, PrimaryButton } from "@/components/AppShell";
import { EmptyState, LoadingPanels } from "@/components/Modal";
import { CategoryForm } from "@/components/CategoryForm";
import { ProductForm } from "@/components/ProductForm";
import { useBranches } from "@/lib/branches";
import {
  useCategoryList,
  useProducts,
  useUpdateCategory,
  useUpdateProduct,
  type CategoryRecord,
  type ProductRecord,
} from "@/lib/catalog";
import { errorMessage } from "@/lib/errors";
import { cedi } from "@/lib/format";
import { accentVar } from "@/lib/accent";
import { useAuth } from "@/lib/auth";
import { useSingleFlight } from "@/lib/useSingleFlight";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Products & categories — StockLine Inventory" },
      {
        name: "description",
        content:
          "Create products and organise them into categories, each with its own custom fields: text, number, date or dropdown.",
      },
      { property: "og:title", content: "Products & categories — StockLine Inventory" },
      {
        property: "og:description",
        content: "Your product catalogue and the categories that shape it.",
      },
    ],
  }),
  component: ProductsPage,
});

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function ProductsPage() {
  const { isAdmin, user, managerSectionEnabled } = useAuth();
  const categoriesQuery = useCategoryList(isAdmin);
  const branchesQuery = useBranches(false);
  const updateCategory = useUpdateCategory();
  const updateProduct = useUpdateProduct();
  const { run } = useSingleFlight();

  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const q = useDebounced(search, 300);
  const productsQuery = useProducts({
    q,
    categoryId: categoryFilter,
    includeInactive: isAdmin && showArchived,
  });

  const categories = categoriesQuery.data ?? [];
  const activeCategories = categories.filter((category) => category.isActive);
  const archivedCategories = categories.filter((category) => !category.isActive);
  const products = productsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const canSeeCost = isAdmin || user?.role === "manager";

  if (!isAdmin && user?.role === "manager" && !managerSectionEnabled) {
    return (
      <AppShell eyebrow="Access" title="Manager access required">
        <EmptyState
          title="Manager access required"
          body="The administrator has deactivated the manager section."
        />
      </AppShell>
    );
  }

  async function archiveCategoryNow(category: CategoryRecord, isActive: boolean) {
    if (!isActive && !confirm(`Archive “${category.name}”?`)) return;
    try {
      await updateCategory.mutateAsync({ id: category.id, isActive });
      toast.success(isActive ? `${category.name} restored` : `${category.name} archived`);
    } catch (error) {
      // For example: "Category still has active products".
      toast.error(errorMessage(error, "Couldn't change that category."));
    }
  }

  async function archiveProductNow(product: ProductRecord, isActive: boolean) {
    if (!isActive && !confirm(`Archive “${product.name}”? It will be hidden from the catalogue.`)) return;
    try {
      await updateProduct.mutateAsync({ id: product.id, isActive });
      toast.success(isActive ? `${product.name} restored` : `${product.name} archived`);
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't change that product."));
    }
  }

  // Extra taps while one change is running are ignored.
  const archiveCategory = (category: CategoryRecord, isActive: boolean) =>
    run(() => archiveCategoryNow(category, isActive));
  const archiveProduct = (product: ProductRecord, isActive: boolean) =>
    run(() => archiveProductNow(product, isActive));

  const categoryName = (id: number | null) =>
    categories.find((category) => category.id === id)?.name ?? "No category";

  return (
    <AppShell
      eyebrow="Catalogue"
      title="Products"
      actions={
        isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <GhostButton
              onClick={() => {
                setEditingCategory(null);
                setCategoryFormOpen(true);
              }}
            >
              <span className="flex items-center gap-1.5">
                <Plus className="size-4" /> New category
              </span>
            </GhostButton>
            <PrimaryButton
              onClick={() => {
                setEditingProduct(null);
                setProductFormOpen(true);
              }}
            >
              <span className="flex items-center gap-1.5">
                <Plus className="size-4" /> Create product
              </span>
            </PrimaryButton>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        {/* ---- Categories ---- */}
        <section>
          <p className="label-mono mb-2">Categories</p>
          {categoriesQuery.isLoading ? (
            <LoadingPanels count={3} />
          ) : categoriesQuery.isError ? (
            <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">
              Could not load categories. Check that the API is running.
            </p>
          ) : activeCategories.length === 0 ? (
            <EmptyState
              icon={<Boxes className="size-6" />}
              title="No categories yet"
              body="Start with something real, like Doors, Goats or Laptops, then add the fields those products carry."
              action={
                isAdmin ? (
                  <PrimaryButton
                    onClick={() => {
                      setEditingCategory(null);
                      setCategoryFormOpen(true);
                    }}
                  >
                    New category
                  </PrimaryButton>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {activeCategories.map((category) => (
                <article key={category.id} className="glass flex flex-col rounded-2xl p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: accentVar(category.accent) }}
                    />
                    <h2 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-strong">
                      {category.name}
                    </h2>
                    {isAdmin && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          aria-label={`Edit ${category.name}`}
                          onClick={() => {
                            setEditingCategory(category);
                            setCategoryFormOpen(true);
                          }}
                          className="grid size-8 place-items-center rounded-lg border border-hair text-fog hover:text-strong"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          aria-label={`Archive ${category.name}`}
                          onClick={() => void archiveCategory(category, false)}
                          className="grid size-8 place-items-center rounded-lg border border-hair text-fog hover:text-rose"
                        >
                          <Archive className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {category.attributes.length === 0 ? (
                      <span className="text-xs text-fog/60">No custom fields</span>
                    ) : (
                      category.attributes.map((field) => (
                        <span
                          key={field.id}
                          className="rounded-lg border border-hair bg-panel/50 px-2 py-1 font-mono text-[11px] text-fog/85"
                        >
                          {field.name}
                          <span className="text-fog/45"> · {field.type}</span>
                        </span>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setCategoryFilter(category.id);
                      document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="mt-4 self-start text-xs text-aurora-a"
                  >
                    View {category.name} products →
                  </button>
                </article>
              ))}
            </div>
          )}

          {isAdmin && archivedCategories.length > 0 && (
            <div className="mt-4">
              <p className="label-mono mb-2">Archived categories</p>
              <div className="flex flex-wrap gap-2">
                {archivedCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => void archiveCategory(category, true)}
                    className="flex items-center gap-1.5 rounded-lg border border-hair px-2.5 py-1.5 text-xs text-fog hover:text-strong"
                  >
                    <ArchiveRestore className="size-3.5" /> Restore {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---- Products ---- */}
        <section id="products">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <p className="label-mono">Products</p>
            {isAdmin && (
              <label className="flex items-center gap-2 text-xs text-fog">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Show archived
              </label>
            )}
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
            <input
              className="field"
              placeholder="Search by name (starts with)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="field"
              value={categoryFilter === null ? "" : String(categoryFilter)}
              onChange={(e) => setCategoryFilter(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All categories</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {productsQuery.isLoading ? (
            <LoadingPanels count={3} />
          ) : productsQuery.isError ? (
            <p className="rounded-xl border border-amber/30 p-3 text-sm text-amber">
              Could not load products. Check that the API is running.
            </p>
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Package className="size-6" />}
              title={q || categoryFilter !== null ? "No products match" : "No products yet"}
              body={
                q || categoryFilter !== null
                  ? "Try a different search or category."
                  : "Products you create appear here."
              }
              action={
                isAdmin && !q && categoryFilter === null ? (
                  <PrimaryButton
                    onClick={() => {
                      setEditingProduct(null);
                      setProductFormOpen(true);
                    }}
                  >
                    Create product
                  </PrimaryButton>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {products.map((product) => {
                const category = categories.find((entry) => entry.id === product.categoryId);
                const details = (category?.attributes ?? [])
                  .filter((field) => product.custom[field.id] !== undefined)
                  .map((field) => `${field.name}: ${product.custom[field.id]}`);
                return (
                  <div
                    key={product.id}
                    className={`flex min-w-0 flex-col gap-3 rounded-xl border border-hair bg-panel/40 px-3 py-3 sm:flex-row sm:items-center ${
                      product.isActive ? "" : "opacity-60"
                    }`}
                  >
                    <div className="min-w-0 sm:flex-1">
                      <p className="break-words text-sm font-medium text-strong">
                        {product.name}
                        {!product.isActive && <span className="label-mono ml-2">Archived</span>}
                      </p>
                      <p className="label-mono mt-0.5">
                        {product.sku} · {categoryName(product.categoryId)}
                        {product.barcode ? ` · ${product.barcode}` : ""}
                      </p>
                      {details.length > 0 && (
                        <p className="mt-1 break-words text-xs text-fog/75">{details.join(" · ")}</p>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="num font-semibold text-aurora-a">{cedi(product.price)}</p>
                      {canSeeCost && product.cost !== undefined && (
                        <p className="label-mono">Cost {cedi(product.cost)}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex w-full gap-2 sm:w-auto">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setProductFormOpen(true);
                          }}
                          className="flex-1 rounded-lg border border-hair px-2.5 py-2 text-xs text-fog hover:text-strong sm:flex-none"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void archiveProduct(product, !product.isActive)}
                          className={`flex-1 rounded-lg border border-hair px-2.5 py-2 text-xs sm:flex-none ${
                            product.isActive ? "text-rose" : "text-fog hover:text-strong"
                          }`}
                        >
                          {product.isActive ? "Archive" : "Restore"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {productsQuery.hasNextPage && (
                <div className="flex justify-center pt-2">
                  <GhostButton onClick={() => void productsQuery.fetchNextPage()}>
                    {productsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                  </GhostButton>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {isAdmin && (
        <>
          <CategoryForm
            open={categoryFormOpen}
            onClose={() => setCategoryFormOpen(false)}
            category={editingCategory}
          />
          <ProductForm
            open={productFormOpen}
            onClose={() => setProductFormOpen(false)}
            categories={activeCategories}
            branches={(branchesQuery.data ?? []).filter((branch) => branch.isActive)}
            product={editingProduct}
            defaultCategoryId={categoryFilter}
          />
        </>
      )}
    </AppShell>
  );
}
