"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // ✅ ログイン画面（ここだけ未ログインでもOK）
  const LOGIN_PATH = "/login";
  const isLoginPage = pathname === LOGIN_PATH;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ✅ 未ログインなら /login 以外へ行けない（Navbar が全ページで描画される前提）
  useEffect(() => {
    if (!authReady) return;
    if (!user && !isLoginPage) {
      router.replace(LOGIN_PATH);
    }
  }, [authReady, user, isLoginPage, router]);

  const isAuthed = !!user;

  const menuLinks = useMemo(
    () => [
      { href: "/project-management", label: "工程表" },
      { href: "/proclink", label: "写真管理" },
      { href: "/sum-quantity", label: "材料積算" },
      { href: "/board-settings", label: "掲示板" },
    ],
    [],
  );

  return (
    <nav className="border-b bg-white shadow-sm dark:bg-gray-950 dark:border-gray-800">
      <div className="mx-auto h-14 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center justify-between gap-3">
          {/* ロゴ */}
          <Link
            href={isAuthed ? "/" : LOGIN_PATH}
            className="text-xl font-bold text-blue-600 dark:text-blue-400"
          >
            Re Nova
          </Link>

          <div className="flex items-center gap-3">
            {/* メニュー：ログイン時のみ表示 */}
            {isAuthed ? (
              <>
                <div className="hidden items-center gap-6 md:flex">
                  {menuLinks.map((m) => (
                    <Link
                      key={m.href}
                      href={m.href}
                      className={cn(
                        "text-gray-700 hover:text-blue-600 transition-colors dark:text-gray-200 dark:hover:text-blue-400",
                      )}
                    >
                      {m.label}
                    </Link>
                  ))}

                  <Link
                    href="/login"
                    className={cn(
                      "text-gray-700 hover:text-blue-600 transition-colors dark:text-gray-200 dark:hover:text-blue-400",
                    )}
                  >
                    ログイン管理
                  </Link>
                </div>
              </>
            ) : (
              <Link
                href={LOGIN_PATH}
                className={cn(
                  "text-gray-700 hover:text-blue-600 transition-colors dark:text-gray-200 dark:hover:text-blue-400",
                )}
              >
                ログイン
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
