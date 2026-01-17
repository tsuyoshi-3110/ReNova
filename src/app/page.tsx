import Image from "next/image"

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <div className="mx-auto mb-6 flex items-center justify-center">
          <Image
            src="/logo.png"               // /public/logo.png を配置
            alt="ReNova ロゴ"
            width={240}
            height={240}
            priority
          />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
          ReNova（レノバ）
        </h1>
        <p className="mt-4 text-lg text-slate-700">
          監督・職人・居住者をひとつにつなぐ「現場アプリ」
        </p>
        <p className="mt-2 text-slate-600">
          工程と連絡を自動化し、ムダな確認や行き違いをなくします。
        </p>
      </section>

      {/* できること */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <h2 className="text-2xl font-bold text-slate-900">できること（かんたんに）</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">工程表の自動作成</h3>
            <p className="mt-1 text-slate-700">
              案件を登録するだけで工種ごとの工程を自動生成。調整すると関係者へ即共有。
            </p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">材料（缶数）表の自動作成</h3>
            <p className="mt-1 text-slate-700">
              面積・仕様を入力すると必要缶数を自動計算。発注漏れや過不足を防止。
            </p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">写真の自動整理</h3>
            <p className="mt-1 text-slate-700">
              撮影写真を日付・工種・場所で自動タグ付け。探す手間ゼロで報告書にも活用。
            </p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">自動連絡（リマインド）</h3>
            <p className="mt-1 text-slate-700">
              各工種の着工が近づくと、担当業者へ注意事項・集合時間・持ち物などをメール自動配信。
            </p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
            <h3 className="font-semibold text-slate-900">居住者向け閲覧</h3>
            <p className="mt-1 text-slate-700">
              進捗、騒音/ベランダ利用予定、<strong>洗濯物の干せる/干せない目安</strong>をスマホで確認。
            </p>
          </li>
        </ul>
      </section>

      {/* メリット */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <h2 className="text-2xl font-bold text-slate-900">それぞれのメリット</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">監督</h3>
            <ul className="mt-2 list-disc pl-5 text-slate-700">
              <li>工程・材料・写真・周知が自動化</li>
              <li>電話/個別チャットの往復が激減</li>
              <li>段取りミスの早期発見</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">職人</h3>
            <ul className="mt-2 list-disc pl-5 text-slate-700">
              <li>事前に作業内容と注意点を受信</li>
              <li>現場入りがスムーズに</li>
              <li>持ち物・搬入の抜け漏れ防止</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">居住者</h3>
            <ul className="mt-2 list-disc pl-5 text-slate-700">
              <li>「いつ・どこで・何の作業か」を可視化</li>
              <li>洗濯・外出の予定が立てやすい</li>
              <li>不安・苦情の減少につながる</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 効果 */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-2xl font-bold text-slate-900">期待できる効果</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          <li className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700 shadow-sm">
            段取りミス・連絡漏れの削減
          </li>
          <li className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700 shadow-sm">
            発注/搬入の精度向上
          </li>
          <li className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700 shadow-sm">
            事前告知と見える化によるトラブル抑止
          </li>
        </ul>
      </section>
    </main>
  )
}
