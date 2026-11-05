"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Merge a patch into the current query string (null/"" removes a key). Keeps refresh/share state in the URL. */
export function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (patch: Record<string, string | null | undefined>, opts: { replace?: boolean; path?: string } = {}) => {
      const next = new URLSearchParams(opts.path ? undefined : params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      const url = `${opts.path ?? pathname}${qs ? `?${qs}` : ""}`;
      if (opts.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [params, pathname, router],
  );
}

/** Opens the task detail sheet (mounted in the app shell) for any page. */
export function useOpenTask() {
  const setParams = useSetParams();
  return useCallback((taskId: string) => setParams({ task: taskId }), [setParams]);
}
