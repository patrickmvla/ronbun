// hooks/use-compare-query.ts
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompareResponse } from "@/types/compare";

export function useCompareQuery(idA: string | null, idB: string | null) {
  const idsParam = useMemo(() => (idA && idB ? `${idA},${idB}` : null), [idA, idB]);

  const query = useQuery({
    queryKey: ["compare", idsParam],
    queryFn: async (): Promise<CompareResponse> => {
      const res = await fetch(`/api/compare?ids=${encodeURIComponent(idsParam!)}`);
      if (!res.ok) throw new Error("Failed to fetch comparison");
      return res.json();
    },
    enabled: Boolean(idsParam),
    staleTime: 60_000,
  });

  return query;
}