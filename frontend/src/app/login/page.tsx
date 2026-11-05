"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Network } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
      qc.clear();
      qc.setQueryData(["me"], user);
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6" data-testid="login-form">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-zinc-900 text-white">
          <Network className="size-4" />
        </span>
        <div>
          <h1 className="text-[15px] font-semibold">ArchBoard</h1>
          <p className="text-xs text-zinc-500">Product architecture & task management</p>
        </div>
      </div>
      <Field label="Email">
        <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} name="email" autoFocus />
      </Field>
      <Field label="Password">
        <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} name="password" />
      </Field>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700" role="alert">{error}</p>}
      <Button type="submit" variant="primary" disabled={pending} className="h-9">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-xs text-zinc-400">Demo: admin@archboard.local / Admin@123</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
