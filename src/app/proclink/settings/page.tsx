// app/admin/settings/page.tsx
import Link from "next/link";
import { ListChecks, Building2, Users } from "lucide-react";

function MenuCard(props: {
  href: string;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const { href, title, desc, Icon } = props;

  return (
    <Link
      href={href}
      className={[
        "group flex items-center justify-between rounded-2xl border p-5 shadow-sm transition",
        "bg-white hover:shadow-md hover:border-gray-300",
        "dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700",
      ].join(" ")}
    >
      <div className="flex items-center gap-4">
        <div
          className={[
            "grid h-12 w-12 place-items-center rounded-xl transition",
            "bg-gray-100 group-hover:bg-gray-200",
            "dark:bg-gray-800 dark:group-hover:bg-gray-700",
          ].join(" ")}
        >
          <Icon className="h-6 w-6 text-gray-800 dark:text-gray-100" />
        </div>

        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-300">{desc}</div>
        </div>
      </div>

      <div className="text-gray-400 transition group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300">
        →
      </div>
    </Link>
  );
}

export default function AdminSettingsMenuPage() {
  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          設定
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          管理画面の各種設定を行います
        </p>

        <div className="mt-6 grid gap-4">
          <MenuCard
            href="/proclink/settings/steps"
            title="工程設定"
            desc="工程テンプレート・並び順・表示名の管理"
            Icon={ListChecks}
          />
          <MenuCard
            href="/proclink/settings/company"
            title="会社情報"
            desc="会社名・住所・連絡先などの基本情報"
            Icon={Building2}
          />
          <MenuCard
            href="/proclink/settings/users"
            title="ユーザー管理"
            desc="管理者・担当者アカウントの管理"
            Icon={Users}
          />
        </div>
      </div>
    </main>
  );
}
