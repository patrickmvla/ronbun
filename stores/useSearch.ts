// stores/useSearch.ts
"use client";

import { create } from "zustand";

export type SearchState = {
  query: string;
  isSearching: boolean;

  // Actions
  setQuery: (q: string) => void;
  clearQuery: () => void;
  setIsSearching: (loading: boolean) => void;
};

export const useSearch = create<SearchState>((set) => ({
  query: "",
  isSearching: false,

  setQuery: (q) => set({ query: q.trim() }),
  clearQuery: () => set({ query: "" }),
  setIsSearching: (loading) => set({ isSearching: loading }),
}));
