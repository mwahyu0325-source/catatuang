import { connection } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { formatRupiah } from "@/lib/format";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";

interface Params { prior?: string; terpilih?: string }

export const instant = false; // halaman data per-request, diblok sampai siap

export default async function LaporanPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  await connection(); // selalu dirender per-request
  const supabase = getSupabase();

  const { data } = await supabase
    .from("transactions")
    .select("type, amount, category, occurred_at")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false });

  const rows = data ?? [];

  // Kelompokkan per bulan (Asia/Jakarta), 12 bulan terakhir
  const byMonth = new Map<string, { income: number; expense: number }>();
  const byCat = new Map<string, number>();
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    byMonth.set(key, { income: 0, expense: 0 });
  }

  const bulanEnum = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date(iso));

  let terpilih = sp.terpilih && byMonth.has(sp.terpilih) ? sp.terpilih : "";
  if (!sp.prior) {
    // Default: kategori bulan berjalan
    for (const r of rows) {
      if (r.type !== "expense") continue;
      if (bulanEnum(r.occurred_at) === now.toISOString().slice(0, 7)) {
        byCat.set(r.category, (byCat.get(r.category) ?? 0) + Number(r.amount));
      }
    }
    terpilih = now.toISOString().slice(0, 7);
  } else if (sp.terpilih && byMonth.has(sp.terpilih)) {
    for (const r of rows) {
      if (r.type !== "expense") continue;
      if (bulanEnum(r.occurred_at) === sp.terpilih) {
        byCat.set(r.category, (byCat.get(r.category) ?? 0) + Number(r.amount));
      }
    }
    terpilih = sp.terpilih;
  }

  const months = [...byMonth.entries()].reverse();
  const maxVal = Math.max(1, ...months.flatMap(([, v]) => [v.income, v.expense]));

  const catRows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const totalThreshold = catRows.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 sm:max-w-3xl sm:px-6">
      <div className="flex items-center justify-between py-4">
        <h1 className="text-lg font-semibold tracking-tight">Laporan</h1>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block"><MainNav /></div>
          <ThemeToggle />
        </div>
      </div>

      <main className="flex-1 pb-24 sm:pb-12">
        <section aria-label="Grafik bulanan" className="border-t border-line pt-6">
          <h2 className="text-sm font-semibold">12 bulan terakhir</h2>
          <div className="mt-4 flex items-end gap-[3px] sm:gap-1.5" style={{ height: "140px" }}>
            {months.map(([key, v]) => {
              const has = v.income > 0 || v.expense > 0;
              return (
                <a
                  key={key}
                  href={`/laporan?prior=y&terpilih=${key}`}
                  title={`${labelBulan(key)} — masuk ${formatRupiah(v.income)}, keluar ${formatRupiah(v.expense)}`}
                  className="group flex h-full flex-1 flex-col justify-end"
                >
                  <div className="mb-2 grid flex-1 grid-cols-2 items-end gap-[2px] sm:gap-1">
                    <div
                      className="read-only rounded-sm bg-income"
                      style={{ height: `${Math.max(v.income > 0 ? 4 : 0, (v.income / maxVal) * 100)}%` }}
                    />
                    <div
                      className="rounded-sm bg-expense"
                      style={{ height: `${Math.max(v.expense > 0 ? 4 : 0, (v.expense / maxVal) * 100)}%` }}
                    />
                  </div>
                  <div className="text-center text-[10px] tracking-tight text-ink-soft group-hover:text-ink">
                    {parseInt(key.slice(5), 10)}
                  </div>
                  <span className="sr-only">{key}</span>
                </a>
              );
            })}
          </div>
          <p className="mt-2 flex gap-4 text-[12px] text-ink-soft">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-income align-middle" />pemasukan</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-expense align-middle" />pengeluaran</span>
          </p>
        </section>

        <section aria-label="Per kategori" className="mt-10">
          <h2 className="text-sm font-semibold">
            Pengeluaran {terpilih && `— ${labelBulan(terpilih)}`}
          </h2>
          {catRows.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
              Belum ada pengeluaran pada periode ini.
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {catRows.map(([cat, total]) => (
                <li key={cat} className="py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm">{cat}</span>
                    <span className="tab-num text-sm font-medium">{formatRupiah(total)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-sm bg-line">
                    <div className="h-full rounded-sm bg-expense" style={{ width: `${(total / Math.max(1, catRows[0][1])) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {totalThreshold === 0 && catRows.length === 0 && null}
        </section>
      </main>
    </div>
  );
}

function labelBulan(key: string): string {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(key + "-01T12:00:00"),
  );
}
