"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";
import ThemeToggleButton from "@/components/theme/ThemeToggleButton";

function friendlyAuthError(code?: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません。";
    case "auth/user-disabled":
      return "このユーザーは無効化されています。";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "メールアドレスまたはパスワードが違います。";
    case "auth/too-many-requests":
      return "試行回数が多すぎます。しばらく待ってから再試行してください。";
    default:
      return "ログインに失敗しました。入力内容と通信状況をご確認ください。";
  }
}

const MEMBER_COL = "reNovaMember";

function normEmail(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}
function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "不明なエラー";
  }
}

async function ensureMemberAllowed(
  u: User
): Promise<{ ok: boolean; message: string }> {
  const uid = u.uid;
  const authEmail = normEmail(u.email);

  if (!uid || !authEmail) {
    await signOut(auth);
    return {
      ok: false,
      message: "ログイン情報が不完全です。再ログインしてください。",
    };
  }

  const ref = doc(db, MEMBER_COL, uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await signOut(auth);
    return {
      ok: false,
      message:
        "このアカウントは許可されていません（メンバー登録がありません）。",
    };
  }

  const data = snap.data() as Record<string, unknown>;
  const allowedMail = normEmail(typeof data.mail === "string" ? data.mail : "");

  if (!allowedMail || allowedMail !== authEmail) {
    await signOut(auth);
    return {
      ok: false,
      message:
        "このアカウントは許可されていません（メールアドレスが一致しません）。",
    };
  }

  return { ok: true, message: "" };
}

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextPath = useMemo(() => {
    const n = sp.get("next");
    return n && n.startsWith("/") ? n : "/"; // デフォルトはホーム
  }, [sp]);

  const [me, setMe] = useState<User | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const isAuthed = !!me;

  // ログイン状態の監視：
  // - 画面表示時に勝手に遷移しない
  // - ただし「許可外でログイン済み」だけは即ログアウト（安全側）
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setMe(u ?? null);

      if (!u) {
        setChecking(false);
        return;
      }

      try {
        const res = await ensureMemberAllowed(u);
        if (!res.ok) {
          setErrorText(res.message);
          setChecking(false);
          return;
        }
        setErrorText(null);
        setChecking(false);
      } catch (e) {
        await signOut(auth);
        setErrorText("権限確認に失敗しました。再ログインしてください。");
        console.log("auth guard error:", e);
        setChecking(false);
      }
    });

    return () => unsub();
  }, []);

  const doLogin = async () => {
    setErrorText(null);

    const em = email.trim();
    if (!em || !password) {
      setErrorText("メールアドレスとパスワードを入力してください。");
      return;
    }

    try {
      setBusy(true);

      // 1) Authログイン
      const cred = await signInWithEmailAndPassword(auth, em, password);

      // 2) Firestore側許可チェック（NGなら即ログアウト）
      const res = await ensureMemberAllowed(cred.user);
      if (!res.ok) {
        setErrorText(res.message);
        return;
      }

      // 3) OKなら「ログイン操作をした時だけ」遷移
      router.replace(nextPath);
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err && "code" in err
          ? String((err as { code?: string }).code)
          : undefined;

      setErrorText(friendlyAuthError(code));
      console.log("login error:", err);
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    setErrorText(null);
    try {
      setBusy(true);
      await signOut(auth);
      // ログアウト後はこの画面に居続ければOK（遷移不要）
    } catch (e: unknown) {
      setErrorText(`ログアウトに失敗しました: ${toErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  // ✅ ボタン1つでトグル（ログイン中はログアウト、未ログインはログイン）
  const onToggle = async () => {
    if (busy) return;
    if (isAuthed) {
      await doLogout();
    } else {
      await doLogin();
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-10 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border bg-white shadow-sm p-6 dark:bg-gray-900 dark:border-gray-800">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
              ReNova ログイン
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              ログイン後、工程設定などの管理機能が利用できます。
            </p>
          </div>

          {/* ✅ グローバルテーマ切替（Navbarにもありますが、ここにも置けます） */}
          <ThemeToggleButton />
        </div>

        {errorText && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">{errorText}</p>
          </div>
        )}

        {checking ? (
          <div className="rounded-xl border bg-white p-4 text-center text-sm font-semibold text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-800">
            読み込み中...
          </div>
        ) : (
          <div className="space-y-4">
            {/* ✅ ログイン中 / 未ログインで表示を入れ替え */}
            {isAuthed ? (
              <div className="rounded-xl border bg-gray-50 px-4 py-3 dark:bg-gray-950 dark:border-gray-800">
                <div className="text-xs font-bold text-gray-600 dark:text-gray-300">
                  ログイン中
                </div>
                <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-gray-100 break-all">
                  {me?.email ?? "（メールなし）"}
                </div>
                <div className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400 break-all">
                  UID: {me?.uid ?? ""}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-bold text-gray-800 dark:text-gray-200">
                    メール
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="mt-2 w-full rounded-xl border px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-blue-200
                               dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800"
                    placeholder="example@mail.com"
                    disabled={busy}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-800 dark:text-gray-200">
                    パスワード
                  </label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    className="mt-2 w-full rounded-xl border px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-blue-200
                               dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800"
                    placeholder="••••••••"
                    disabled={busy}
                  />
                </div>
              </>
            )}

            {/* ✅ トグルボタン（1つ） */}
            <button
              type="button"
              onClick={() => void onToggle()}
              disabled={busy}
              className={[
                "w-full rounded-xl px-4 py-3 font-extrabold",
                isAuthed
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "bg-blue-600 text-white hover:bg-blue-700",
                "disabled:opacity-60",
              ].join(" ")}
            >
              {busy ? "処理中..." : isAuthed ? "ログアウト" : "ログイン"}
            </button>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              ※ Firestore の{" "}
              <code className="font-mono">reNovaMember/{`{uid}`}</code>{" "}
              に登録があり、
              <code className="font-mono"> mail </code>
              が一致するユーザーのみ利用可能です。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
