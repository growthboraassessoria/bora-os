"use client";
// Quando uma ação sensível pede confirmação, leva a pessoa a digitar o código e volta para onde estava.
import { usePathname, useSearchParams } from "next/navigation";
import type { ActionResult } from "@/lib/errors";

export function useStepUp() {
  const path = usePathname();
  const sp = useSearchParams();
  return <T,>(r: ActionResult<T>) => {
    if (!r.ok && r.stepUp) {
      const here = `${path}${sp.size ? `?${sp}` : ""}`;
      window.location.href = `/login/codigo?next=${encodeURIComponent(here)}`;
      return true;
    }
    return false;
  };
}
