"use client";

import React, { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./AuthProvider";

const PUBLIC_PATHS = ["/login"]; // ここだけ未ログインでOK

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const isPublic = useMemo(() => {
    return PUBLIC_PATHS.includes(pathname);
  }, [pathname]);

  const nextUrl = useMemo(() => {
    const q = sp.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, sp]);

  useEffect(() => {
    if (loading) return;
    if (isPublic) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
    }
  }, [loading, isPublic, user, router, nextUrl]);

  // 認証判定中は何も出さない（チラつき回避）
  if (loading) return null;

  // 未ログインで保護ページなら何も出さない（リダイレクト待ち）
  if (!isPublic && !user) return null;

  return <>{children}</>;
}
