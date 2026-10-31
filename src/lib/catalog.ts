import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiRequest } from "./api";
import { useAuth } from "./auth";
import { useHydrated } from "./theme";

// ---- Types -------------------------------------------------------------------------------
// A CATEGORY is a type of item (laptops, doors) with its own custom fields, shared by all branches.
// A PRODUCT belongs to one category. How many of it a branch holds is stock, which is separate.

export type FieldType = "text" | "number" | "date" | "select";
export type CategoryAccent = "a" | "b" | "c" | "amber" | "rose";

export type CategoryField = {
  id: string;
  name: string;
  type: FieldType;
  options?: string[];
  required: boolean;
};

export type CategoryRecord = {
  id: number;
  name: string;
  accent: CategoryAccent;
  attributes: CategoryField[];
  isActive: boolean;
};

export type ProductRecord = {
  id: number;
  sku: string;
  name: string;
  categoryId: number | null;
  barcode: string | null;
  notes: string | null;
  /** Values keyed by the category field's id. */
  custom: Record<string, string | number>;
  isActive: boolean;
  /** Cedis as text, for example "750.00". Never do arithmetic on it in the browser. */
  price: string;
  /** Only sent to managers and admins. Missing means "not allowed to see", not zero. */
  cost?: string;
};

type ProductPage = { items: ProductRecord[]; nextCursor: number | null };

const CATEGORIES_KEY = ["categories"] as const;
const PRODUCTS_KEY = ["products"] as const;

// ---- Categories --------------------------------------------------------------------------

export function useCategoryList(includeInactive = false) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useQuery({
    queryKey: [...CATEGORIES_KEY, { includeInactive }],
    queryFn: async () => {
      const result = await apiRequest<{ items: CategoryRecord[] }>(
        `/categories?includeInactive=${includeInactive}`,
      );
      return result.items;
    },
    enabled: hydrated && !!user,
    staleTime: 60_000,
  });
}

export type CategoryInput = {
  name: string;
  accent: CategoryAccent;
  // A field without an id is new; the server gives it a stable id.
  attributes: {
    id?: string;
    name: string;
    type: FieldType;
    options?: string[];
    required: boolean;
  }[];
};

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) => apiPost<CategoryRecord>("/categories", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }); // refresh in the background; don't hold the form open
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Partial<CategoryInput> & { isActive?: boolean }) =>
      apiRequest<CategoryRecord>(`/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }); // refresh in the background; don't hold the form open
    },
  });
}

// ---- Products ----------------------------------------------------------------------------

export type ProductFilters = {
  q: string;
  categoryId: number | null;
  includeInactive: boolean;
};

/** Products one page at a time. The server returns a cursor; "Load more" asks for the next page. */
export function useProducts(filters: ProductFilters) {
  const hydrated = useHydrated();
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...PRODUCTS_KEY, filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "50", after: String(pageParam) });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.categoryId !== null) params.set("categoryId", String(filters.categoryId));
      if (filters.includeInactive) params.set("includeInactive", "true");
      return apiRequest<ProductPage>(`/products?${params.toString()}`);
    },
    getNextPageParam: (lastPage: ProductPage) => lastPage.nextCursor ?? undefined,
    enabled: hydrated && !!user,
  });
}

export type ProductInput = {
  name: string;
  categoryId: number;
  sku?: string;
  barcode?: string;
  notes?: string;
  custom: Record<string, string | number>;
  cost?: string;
  price?: string;
};

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) => apiPost<ProductRecord>("/products", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }); // refresh in the background; don't hold the form open
    },
  });
}

export type ProductPatch = {
  id: number;
  name?: string;
  categoryId?: number;
  barcode?: string | null;
  notes?: string;
  custom?: Record<string, string | number>;
  cost?: string;
  price?: string;
  isActive?: boolean;
};

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: ProductPatch) =>
      apiRequest<ProductRecord>(`/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }); // refresh in the background; don't hold the form open
    },
  });
}

/** Adds opening stock to a branch right after a product is created. */
export function addStock(input: { locationId: number; productId: number; quantity: number }) {
  return apiPost<{ newQuantity: number }>("/stock/in", { ...input, reason: "Opening stock" });
}
