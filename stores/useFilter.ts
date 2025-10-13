// stores/useFilters.ts
// Feed filters (Zustand + persist) with URL helpers and arXiv query builder.
// Safe for SSR: memory storage fallback and hydration flag.

"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export type ViewTab = "today" | "week" | "for-you";
export type SortBy = "submittedDate" | "lastUpdatedDate";
export type SortOrder = "ascending" | "descending";

export type FiltersState = {
  // Primary
  view: ViewTab;
  categories: string[];       // arXiv categories
  search: string;             // free text
  // Secondary (best-effort text filters; not native to arXiv)
  method: string;
  dataset: string;
  benchmark: string;
  codeOnly: boolean;
  hasWeights: boolean;
  withBenchmarks: boolean;

  // Sorting / paging
  sortBy: SortBy;
  sortOrder: SortOrder;
  pageSize: number;

  // Hydration flag
  hasHydrated: boolean;

  // Actions
  setView: (v: ViewTab) => void;
  setCategories: (cats: string[]) => void;
  toggleCategory: (cat: string) => void;
  setSearch: (q: string) => void;
  setMethod: (m: string) => void;
  setDataset: (d: string) => void;
  setBenchmark: (b: string) => void;
  setCodeOnly: (on: boolean) => void;
  toggleCodeOnly: () => void;
  setHasWeights: (on: boolean) => void;
  setWithBenchmarks: (on: boolean) => void;
  setSortBy: (by: SortBy) => void;
  setSortOrder: (ord: SortOrder) => void;
  setPageSize: (n: number) => void;

  setMany: (patch: Partial<Omit<FiltersState, "hasHydrated" | keyof Actions>>) => void;
  reset: () => void;

  // URL helpers
  toParams: () => URLSearchParams;
  fromParams: (input: string | URLSearchParams) => void;

  // Query builder (for /api/arxiv/search)
  buildArxivQuery: () => string;

  // Internal
  _setHasHydrated: (v: boolean) => void;
};

type Actions = Pick<
  FiltersState,
  | "setView"
  | "setCategories"
  | "toggleCategory"
  | "setSearch"
  | "setMethod"
  | "setDataset"
  | "setBenchmark"
  | "setCodeOnly"
  | "toggleCodeOnly"
  | "setHasWeights"
  | "setWithBenchmarks"
  | "setSortBy"
  | "setSortOrder"
  | "setPageSize"
  | "setMany"
  | "reset"
  | "toParams"
  | "fromParams"
  | "buildArxivQuery"
  | "_setHasHydrated"
>;

export const DEFAULT_CATS = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE", "stat.ML"] as const;

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const getStorage = () =>
  typeof window !== "undefined" ? (localStorage as unknown as StateStorage) : memoryStorage;

const initial: Omit<FiltersState, keyof Actions> = {
  view: "today",
  categories: [...DEFAULT_CATS],
  search: "",
  method: "",
  dataset: "",
  benchmark: "",
  codeOnly: false,
  hasWeights: false,
  withBenchmarks: false,
  sortBy: "submittedDate",
  sortOrder: "descending",
  pageSize: 25,
  hasHydrated: false,
};

export const useFilters = create<FiltersState>()(
  persist(
    (set, get) => ({
      ...initial,

      setView: (v) => set({ view: v }),
      setCategories: (cats) => set({ categories: dedupeStrings(cats).filter(Boolean) }),
      toggleCategory: (cat) =>
        set((s) => {
          const exists = s.categories.includes(cat);
          return { categories: exists ? s.categories.filter((c) => c !== cat) : [...s.categories, cat] };
        }),

      setSearch: (q) => set({ search: q }),
      setMethod: (m) => set({ method: m }),
      setDataset: (d) => set({ dataset: d }),
      setBenchmark: (b) => set({ benchmark: b }),
      setCodeOnly: (on) => set({ codeOnly: on }),
      toggleCodeOnly: () => set((s) => ({ codeOnly: !s.codeOnly })),
      setHasWeights: (on) => set({ hasWeights: on }),
      setWithBenchmarks: (on) => set({ withBenchmarks: on }),

      setSortBy: (by) => set({ sortBy: by }),
      setSortOrder: (ord) => set({ sortOrder: ord }),
      setPageSize: (n) => set({ pageSize: clampPageSize(n) }),

      setMany: (patch) => set(patch as any),

      reset: () => set({ ...initial, hasHydrated: true }),

      toParams: () => {
        const s = get();
        const usp = new URLSearchParams();
        usp.set("view", s.view);
        if (s.categories.length) usp.set("cats", s.categories.join(","));
        if (s.search.trim()) usp.set("q", s.search.trim());
        if (s.method.trim()) usp.set("m", s.method.trim());
        if (s.dataset.trim()) usp.set("ds", s.dataset.trim());
        if (s.benchmark.trim()) usp.set("bm", s.benchmark.trim());
        if (s.codeOnly) usp.set("code", "1");
        if (s.hasWeights) usp.set("weights", "1");
        if (s.withBenchmarks) usp.set("bench", "1");
        if (s.sortBy !== "submittedDate") usp.set("sb", s.sortBy);
        if (s.sortOrder !== "descending") usp.set("so", s.sortOrder);
        if (s.pageSize !== 25) usp.set("ps", String(s.pageSize));
        return usp;
      },

      fromParams: (input) => {
        const usp = typeof input === "string" ? new URLSearchParams(input) : input;
        const view = asView(usp.get("view")) ?? "today";
        const catParam = usp.get("cats");
        const cats = catParam ? catParam.split(",").map((s) => s.trim()).filter(Boolean) : [...DEFAULT_CATS];
        const search = usp.get("q")?.trim() || "";
        const method = usp.get("m")?.trim() || "";
        const dataset = usp.get("ds")?.trim() || "";
        const benchmark = usp.get("bm")?.trim() || "";
        const codeOnly = usp.get("code") === "1";
        const hasWeights = usp.get("weights") === "1";
        const withBenchmarks = usp.get("bench") === "1";
        const sortBy = asSortBy(usp.get("sb")) ?? "submittedDate";
        const sortOrder = asSortOrder(usp.get("so")) ?? "descending";
        const pageSize = clampPageSize(Number(usp.get("ps") || 25));

        set({
          view,
          categories: dedupeStrings(cats),
          search,
          method,
          dataset,
          benchmark,
          codeOnly,
          hasWeights,
          withBenchmarks,
          sortBy,
          sortOrder,
          pageSize,
        });
      },

      buildArxivQuery: () => {
        const { categories, search, method, dataset, benchmark } = get();
        const catClause =
          categories.length > 0 ? categories.map((c) => `cat:${c}`).join(" OR ") : "";

        const extras = [search, method, dataset, benchmark]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(" ");

        if (catClause && extras) return `(${catClause}) AND all:${escapeQuery(extras)}`;
        if (catClause) return catClause;
        if (extras) return `all:${escapeQuery(extras)}`;
        return ""; // caller should guard on empty
      },

      _setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "ronbun:filters",
      version: 1,
      storage: createJSONStorage(getStorage),
      partialize: (s) => ({
        view: s.view,
        categories: s.categories,
        search: s.search,
        method: s.method,
        dataset: s.dataset,
        benchmark: s.benchmark,
        codeOnly: s.codeOnly,
        hasWeights: s.hasWeights,
        withBenchmarks: s.withBenchmarks,
        sortBy: s.sortBy,
        sortOrder: s.sortOrder,
        pageSize: s.pageSize,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
      migrate: (persisted, version) => {
        const p: any = persisted ?? {};
        if (!Array.isArray(p.categories)) p.categories = [...DEFAULT_CATS];
        if (!p.view) p.view = "today";
        if (!p.sortBy) p.sortBy = "submittedDate";
        if (!p.sortOrder) p.sortOrder = "descending";
        if (!p.pageSize) p.pageSize = 25;
        ["search", "method", "dataset", "benchmark"].forEach((k) => {
          if (typeof p[k] !== "string") p[k] = "";
        });
        ["codeOnly", "hasWeights", "withBenchmarks"].forEach((k) => {
          if (typeof p[k] !== "boolean") p[k] = false;
        });
        return p;
      },
    }
  )
);

/* ========== Small helpers ========== */

export function useHasHydratedFilters() {
  return useFilters((s) => s.hasHydrated);
}

function dedupeStrings(arr: string[]) {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

function clampPageSize(n: number) {
  if (!Number.isFinite(n)) return 25;
  return Math.min(100, Math.max(5, Math.round(n)));
}

function asView(v: string | null): ViewTab | null {
  return v === "today" || v === "week" || v === "for-you" ? v : null;
}

function asSortBy(v: string | null): SortBy | null {
  return v === "submittedDate" || v === "lastUpdatedDate" ? v : null;
}

function asSortOrder(v: string | null): SortOrder | null {
  return v === "ascending" || v === "descending" ? v : null;
}

function escapeQuery(q: string) {
  return q.replace(/\s+/g, "+");
}