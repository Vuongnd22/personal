"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setUnauthorizedHandler } from "@/lib/api-client";
import { useMe } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/display";

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();

  useEffect(() => {
    const toLogin = () => router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    setUnauthorizedHandler(toLogin);
    return () => setUnauthorizedHandler(null);
  }, [router]);

  useEffect(() => {
    if (me.isError) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [me.isError, pathname, router]);

  if (!me.data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-6 w-40" />
      </div>
    );
  }
  return (
    <Suspense>
      <AppShell user={me.data}>{children}</AppShell>
    </Suspense>
  );
}
