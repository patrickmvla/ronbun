// stores/useCompare.ts
// In-app compare selection (two-slot) with URL-friendly helpers.
// Safe for SSR: uses memory storage fallback when window is undefined.

"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export type CompareState = {
  // Two slots (arXiv base IDs like 2501.12345)
  a: string | null;
  b: string | null;

  // Recently selected IDs (base IDs), newest first
  recent: string[];

  // Actions
  setA: (input: string | null) => void;
  setB: (input: string | null) => void;
  set: (input: string) => void; // fills first empty; otherwise replaces A
  setBoth: (a?: string | null, b?: string | null) => void;
  swap: () => void;
  clear: (which?: "a" | "b" | "both") => void;

  // URL helpers
  fromParam: (idsParam: string) => void; // e.g., "2501.10000,2501.10011"
  toParam: () => string;                 // returns "a,b" or "" if incomplete

  // Derived helpers
  isReady: () => boolean; // both set
  getIds: () => [string | null, string | null];

  // Internals
  addRecent: (id: string) => void;
};

// Memory storage for SSR
const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const getStorage = () =>
  typeof window !== "undefined" ? (localStorage as unknown as StateStorage) : memoryStorage;

const initial: Omit<
  CompareState,
  | "setA"
  | "setB"
  | "set"
  | "setBoth"
  | "swap"
  | "clear"
  | "fromParam"
  | "toParam"
  | "isReady"
  | "getIds"
  | "addRecent"
> = {
  a: null,
  b: null,
  recent: [],
};

export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      ...initial,

      setA: (input) =>
        set((state) => {
          const id = input ? parseInputToBaseId(input) : null;
          if (id && id === state.b) return state; // no-dup
          if (id) {
            const nextRecent = updateRecent(state.recent, id);
            return { a: id, recent: nextRecent };
          }
          return { a: null };
        }),

      setB: (input) =>
        set((state) => {
          const id = input ? parseInputToBaseId(input) : null;
          if (id && id === state.a) return state; // no-dup
          if (id) {
            const nextRecent = updateRecent(state.recent, id);
            return { b: id, recent: nextRecent };
          }
          return { b: null };
        }),

      set: (input) =>
        set((state) => {
          const id = parseInputToBaseId(input);
          if (!id) return state;
          if (id === state.a || id === state.b) return state;
          const nextRecent = updateRecent(state.recent, id);
          if (!state.a) return { a: id, recent: nextRecent };
          if (!state.b) return { b: id, recent: nextRecent };
          return { a: id, recent: nextRecent }; // replace A if both filled
        }),

      setBoth: (aIn, bIn) =>
        set((state) => {
          const a = aIn ? parseInputToBaseId(aIn) : null;
          const b = bIn ? parseInputToBaseId(bIn) : null;
          const recentIds = [a, b].filter(Boolean) as string[];
          const nextRecent = recentIds.reduce(updateRecent, state.recent);
          // Avoid dup: if equal, keep only a
          return { a, b: b && a === b ? null : b, recent: nextRecent };
        }),

      swap: () =>
        set((state) => ({ a: state.b, b: state.a })),

      clear: (which) => {
        if (which === "a") set({ a: null });
        else if (which === "b") set({ b: null });
        else set({ a: null, b: null });
      },

      fromParam: (idsParam) =>
        set((state) => {
          const [rawA, rawB] = String(idsParam || "")
            .split(",")
            .map((s) => s.trim())
            .slice(0, 2);
          const a = rawA ? parseInputToBaseId(rawA) : null;
          const b = rawB ? parseInputToBaseId(rawB) : null;
          const recentIds = [a, b].filter(Boolean) as string[];
          const nextRecent = recentIds.reduce(updateRecent, state.recent);
          return { a, b: b && a === b ? null : b, recent: nextRecent };
        }),

      toParam: () => {
        const { a, b } = get();
        return a && b ? `${a},${b}` : a || b || "";
      },

      isReady: () => {
        const { a, b } = get();
        return Boolean(a && b);
      },

      getIds: () => {
        const { a, b } = get();
        return [a, b];
      },

      addRecent: (id) =>
        set((state) => ({ recent: updateRecent(state.recent, parseInputToBaseId(id) || id) })),
    }),
    {
      name: "ronbun:compare",
      version: 1,
      storage: createJSONStorage(getStorage),
      partialize: (s) => ({ a: s.a, b: s.b, recent: s.recent }),
      migrate: (persisted, version) => {
        const p: any = persisted ?? {};
        if (!Array.isArray(p.recent)) p.recent = [];
        // De-dup / sanitize
        p.recent = Array.from(new Set(p.recent.filter((x: any) => typeof x === "string" && !!x)));
        return p;
      },
    }
  )
);

/* ========== Helpers (local) ========== */

/**
 * Accepts:
 * - "2501.12345" or "2501.12345v2"
 * - https://arxiv.org/abs/2501.12345v2
 * - https://arxiv.org/pdf/2501.12345.pdf
 * Returns base id (without version) or null.
 */
export function parseInputToBaseId(input?: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  const urlAbs = s.match(/arxiv\.org\/abs\/(\d{4}\.\d{5})(?:v\d+)?/i);
  if (urlAbs?.[1]) return urlAbs[1];

  const urlPdf = s.match(/arxiv\.org\/pdf\/(\d{4}\.\d{5})(?:v\d+)?\.pdf/i);
  if (urlPdf?.[1]) return urlPdf[1];

  const raw = s.match(/^(\d{4}\.\d{5})(?:v\d+)?$/);
  if (raw?.[1]) return raw[1];

  return null;
}

function updateRecent(list: string[], id: string): string[] {
  const base = id;
  const next = [base, ...list.filter((x) => x !== base)];
  return next.slice(0, 12); // cap
}