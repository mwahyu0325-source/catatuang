import Link from "next/link";
import { connection } from "next/server";
import { getSupabase, type TransactionRow } from "@/lib/supabase";
import { formatRupiah, formatTanggal, hariRelatif } from "@/lib/format";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";

function Angka({ value, tone }: { value: number; tone: "ink" | "income" | "expense" }) {
  return (
    <span className={"tab-num text-2xl font-semibold tracking-tight sm:text-3xl text-" + tone}>
      {formatRupiah(value)}
    </span>
  );
}


interface Row { amount: number; type: string }

async function getData() {
  const supabase = getSupabase();
  const kini = new Date();
  const awalBulan = new Date(
    Date.UTC(kini.getUTCFullYear(), kini.getUTCMonth(), 1),
  ).toISOString();

  const [semua, bulanIni, perluReview] = await Promise.all([
    supabase.from("transactions").select("type, amount").is("deleted_at", null),
    supabase
      .from("transactions")
      .select("type, amount")
      .is("deleted_at", null)
      .gte("occurred_at", awalBulan),
    supabase
      .from("transactions")
      .select("id, note, amount, type, category, occurred_at")
      .is("deleted_at", null)
      .eq("needs_review", true)
      .order("occurred_at", { ascending: false })
      .limit(5),
  ]);

  const total = (rows: Row[] | null, tipe: string) =>
    (rows ?? []).filter((r) => r.type === tipe).reduce((s, r) => s + Number(r.amount), 0);

  const terakhirReq = supabase
    .from("transactions")
    .select("id, note, amount, type, category, subcategory, occurred_at")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(6);

  const terakhir = await terakhirReq;

  return {
    totalIncome: total(semua.data, "income"),
    totalExpense: total(semua.data, "expense"),
    bulanIncome: total(bulanIni.data, "income"),
    bulanExpense: total(bulanIni.data, "expense"),
    perluReview: perluReview.data ?? [],
    terakhir: (terakhir.data ?? []) as unknown as TransactionRow[],
  };
}

export const instant = false; // halaman data per-request, diblok sampai siap

export default async function RingkasanPage() {
  await connection(); // selalu dirender per-request (data runtime Supabase)
  const d = await getData();
  const saldo = d.totalIncome - d.totalExpense;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 sm:max-w-3xl sm:px-6">
      <header className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">CatatUang</h1>
          <p className="text-[13px] text-ink-soft">
            {new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "Asia/Jakarta" }).format(new Date())}
          </p>
        </div>
        <ThemeToggle />
      </header>
      <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
        <MainNav />
      </div>

      <main className="flex-1 pb-24 sm:pb-12">
        <section aria-label="Saldo" className="border-t border-line pt-6">
          <p className="text-[13px] uppercase tracking-wide text-ink-soft">Saldo total (semua waktu)</p>
          <div className="mt-1 text-4xl font-semibold tab-num tracking-tight sm:text-5xl">
            {formatRupiah(saldo)}
          </div>
          <dl className="mt-5 grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
            {[
              ["Pemasukan bulan ini", d.bulanIncome, "income"],
              ["Pengeluaran bulan ini", d.bulanExpense, "expense"],
              ["Total pemasukan", d.totalIncome, "ink"],
              ["Total pengeluaran", d.totalExpense, "ink"],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="border-l-2 border-line pl-3">
                <dt className="text-[13px] text-ink-soft">{label}</dt>
                <dd className={"tab-num mt-0.5 text-xl font-medium " + (tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "")}>
                  {formatRupiah(Number(value))}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {d.perluReview.length > 0 && (
          <section aria-label="Perlu review" className="mt-10 rounded-lg border border-line bg-income-wash/40 p-4">
            <h2 className="text-sm font-semibold">
              {d.perluReview.length} transaksi perlu review kategori
            </h2>
            <ul className="mt-2 divide-y divide-line">
              {d.perluReview.map((t: Record<string, unknown>) => (
                <li key={String(t.id)} className="flex items-baseline justify-between py-2 text-sm">
                  <span>
                    {String(t.note)} <span className="text-ink-soft">· {String(t.category)}</span>
                  </span>
                  <span className="tab-num">{formatRupiah(Number(t.amount))}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-ink-soft">
              Koreksi via tombol kategori di bot Telegram.
            </p>
          </section>
        )}

        <section aria-label="Transaksi terakhir" className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Transaksi terakhir</h2>
            <Link href="/transaksi" className="text-[13px] text-ink-soft hover:text-ink hover:underline">
              Lihat semua
            </Link>
          </div>

          {d.terakhir.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-line p-8 text-center text-ink-soft">
              <p className="text-sm">Belum ada transaksi.</p>
              <p className="mt-1 text-[13px]">
                Mulai catat lewat Telegram: <code className="font-mono">/out kopi 15rb</code>
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {d.terakhir.map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{t.note}</p>
                    <p className="text-[13px] text-ink-soft">
                      {t.category}
                      {t.subcategory ? ` · ${t.subcategory}` : ""} · {hariRelatif(t.occurred_at)}
                      {" "}
                      <span className="tab-num">
                        {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(t.occurred_at))}
                      </span>
                    </p>
                  </div>
                  <p className={"tab-num shrink-0 text-sm font-medium " + (t.type === "income" ? "text-income" : "")}>
                    {t.type === "income" ? "+" : ""}
                    {formatRupiah(t.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
