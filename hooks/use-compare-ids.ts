// hooks/use-compare-ids.ts
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseInputToBaseId } from "@/lib/compare-utils";

export function useCompareIds(defaultA = "2501.10000", defaultB = "2501.10011") {
  const router = useRouter();
  const sp = useSearchParams();

  const [idAInput, setIdAInput] = React.useState("");
  const [idBInput, setIdBInput] = React.useState("");
  const [idA, setIdA] = React.useState<string | null>(null);
  const [idB, setIdB] = React.useState<string | null>(null);

  // Initialize from URL or defaults
  React.useEffect(() => {
    const idsParam = sp.get("ids");
    if (idsParam) {
      const parts = idsParam.split(",").map((s) => s.trim()).slice(0, 2);
      const [a, b] = parts;
      const A = parseInputToBaseId(a);
      const B = parseInputToBaseId(b);
      setIdAInput(a || "");
      setIdBInput(b || "");
      setIdA(A);
      setIdB(B);
    } else {
      setIdAInput(defaultA);
      setIdBInput(defaultB);
      setIdA(defaultA);
      setIdB(defaultB);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL when ids change
  React.useEffect(() => {
    if (!idA || !idB) return;
    const ids = `${idA},${idB}`;
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set("ids", ids);
    router.replace(`?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idA, idB]);

  const validA = !!parseInputToBaseId(idAInput);
  const validB = !!parseInputToBaseId(idBInput);

  const onApply = () => {
    const A = parseInputToBaseId(idAInput);
    const B = parseInputToBaseId(idBInput);
    setIdA(A);
    setIdB(B);
  };

  const onSwap = () => {
    setIdAInput((prev) => {
      const tmp = idBInput;
      setIdBInput(prev);
      return tmp;
    });
    setIdA((prev) => {
      const tmp = idB;
      setIdB(prev);
      return tmp || null;
    });
  };

  const onRandom = () => {
    const r1 = 10000 + Math.floor(Math.random() * 30);
    let r2 = 10000 + Math.floor(Math.random() * 30);
    if (r2 === r1) r2 = r1 + 1;
    const A = `2501.${r1}`;
    const B = `2501.${r2}`;
    setIdAInput(A);
    setIdBInput(B);
    setIdA(A);
    setIdB(B);
  };

  const onInputsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && validA && validB) {
      e.preventDefault();
      onApply();
    }
  };

  return {
    idAInput,
    idBInput,
    setIdAInput,
    setIdBInput,
    idA,
    idB,
    validA,
    validB,
    onApply,
    onSwap,
    onRandom,
    onInputsKeyDown,
  };
}