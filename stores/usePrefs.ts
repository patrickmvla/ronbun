// stores/usePrefs.ts
// Client-side UI preferences (Zustand + persist).
// Safe for SSR: includes hydration flag and memory storage fallback.

"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export type ViewTab = "today" | "week" | "for-you";
export type ExplainerLevel = "eli5" | "student" | "expert";
export type Density = "comfortable" | "compact";

export type PrefsState = {
  // UI
  density: Density;                 // card/table density
  showBadges: boolean;              // show code/benchmarks badges on feeds
  // Content defaults
  defaultView: ViewTab;             // default feed tab
  explainerLevel: ExplainerLevel;   // default explainer level
  // Hydration (SSR)
  hasHydrated: boolean;

  // Actions
  setDensity: (d: Density) => void;
  toggleDensity: () => void;
  setDefaultView: (v: ViewTab) => void;
  setExplainerLevel: (lvl: ExplainerLevel) => void;
  setShowBadges: (on: boolean) => void;
  reset: () => void;
  _setHasHydrated: (v: boolean) => void; // internal
};

// Memory storage fallback for SSR/Edge
const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const getStorage = () =>
  typeof window !== "undefined" ? (localStorage as unknown as StateStorage) : memoryStorage;

const initialPrefs: Omit<PrefsState, "setDensity" | "toggleDensity" | "setDefaultView" | "setExplainerLevel" | "setShowBadges" | "reset" | "_setHasHydrated"> = {
  density: "comfortable",
  showBadges: true,
  defaultView: "today",
  explainerLevel: "student",
  hasHydrated: false,
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      ...initialPrefs,

      setDensity: (d) => set({ density: d }),
      toggleDensity: () => set({ density: get().density === "comfortable" ? "compact" : "comfortable" }),
      setDefaultView: (v) => set({ defaultView: v }),
      setExplainerLevel: (lvl) => set({ explainerLevel: lvl }),
      setShowBadges: (on) => set({ showBadges: on }),

      reset: () => set({ ...initialPrefs, hasHydrated: true }),
      _setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "ronbun:prefs",
      version: 1,
      storage: createJSONStorage(getStorage),
      partialize: (state) => ({
        density: state.density,
        showBadges: state.showBadges,
        defaultView: state.defaultView,
        explainerLevel: state.explainerLevel,
      }),
      onRehydrateStorage: () => (state) => {
        // Called after hydration (client)
        state?._setHasHydrated(true);
      },
      migrate: (persisted, version) => {
        // Basic forward-compatible migration
        const p: any = persisted ?? {};
        if (version < 1) {
          // Example future migrations
        }
        // Ensure defaults for new keys
        if (p.showBadges === undefined) p.showBadges = true;
        if (!p.explainerLevel) p.explainerLevel = "student";
        if (!p.defaultView) p.defaultView = "today";
        if (!p.density) p.density = "comfortable";
        return p;
      },
    }
  )
);

/**
 * Optional helper: avoid rendering until hydration to prevent SSR mismatch.
 * Usage: const hydrated = useHasHydrated(); if (!hydrated) return null;
 */
export function useHasHydrated() {
  return usePrefs((s) => s.hasHydrated);
}