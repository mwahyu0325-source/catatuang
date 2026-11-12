import { connection } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { formatRupiah } from "@/lib/format";
import { PageShell, Bagian } from "@/components/page-shell";
import { DonutChart, BarKategori, warnaKategori } from "@/components/charts";
import { LineTren } from "@/components/line-tren";
import { Timeline } from "@/components/timeline";
import type { TransactionRow } from "@/lib/supabase";

interface Params {
  prior?: string
  terpilih?: string
}

export const instant = false; // halaman data per-request, diblok sampai siap

function labelBulan(key: string): string {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(key + "-01T12:00:00"),
  );
}

export default async function LaporanPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  await connection(); // selalu dirender per-request
  const supabase = getSupabase();

  const { data } = await supabase
    .from("transactions")
    .select("id, type, amount, category, subcategory, needs_review, occurred_at")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false });

  const rows = data ?? [];
  const rowsTerpilih = rows as unknown as TransactionRow[];

  // 12 bulan terakhir, perbandingan masuk vs keluar per bulan
  const now = new Date();
  const bulanBerlin = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(
      new Date(iso),
    );

  const byMonth = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    byMonth.set(d.toISOString().slice(0, 7), { income: 0, expense: 0 });
  }

  // Rincian untuk bulan terpilih (default: bulan berjalan)
  const semuaBulan = [...byMonth.keys()];
  const terpilih = sp.terpilih && byMonth.has(sp.terpilih) ? sp.terpilih : semuaBulan[semuaBulan.length - 1];

  const byCat = new Map<string, number>();
  let masukBulanTerpilih = 0;
  const transaksiBulanIni: TransactionRow[] = [];
  for (const r of rowsTerpilih) {
    const b = bulanBerlin(r.occurred_at);
    const m = byMonth.get(b);
    if (m) {
      if (r.type === "income") m.income += Number(r.amount);
      else m.expense += Number(r.amount);
    }
    if (b === terpilih) {
      transaksiBulanIni.push(r);
      if (r.type === "expense") {
        byCat.set(r.category, (byCat.get(r.category) ?? 0) + Number(r.amount));
      } else {
        masukBulanTerpilih += Number(r.amount);
      }
    }
  }

  // Kelompokkan kategori per warna (stabil, urut berdasarkan total)
  const catItems = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const slices = catItems.map(([label, value], i) => ({ label, value, color: warnaKategori(i) }));
  const totalKeluarTerpilih = catItems.reduce((s, [, v]) => s + v, 0);
  const netTerpilih = masukBulanTerpilih - totalKeluarTerpilih;

  // 12 bulan (urutan lama → baru)
  const months = [...byMonth.entries()].reverse();

  return (
    <PageShell title="Laporan" subtitle={`${labelBulan(terpilih)}`}>
      {/* Perbandingan bulanan: batang ganda per bulan */}
      <Bagian title="Perbandingan masuk vs keluar — 12 bulan">
        <PerbandinganBulanan months={months} />
      </Bagian>

      {/* Tren neto bulanan & saldo kumulatif */}
      <Bagian title="Tren neto & saldo — 12 bulan" className="mt-8">
        <div className="mt-3 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-[12.5px] font-medium uppercase tracking-wide text-ink-soft">
              Neto per bulan
            </p>
            <LineTren
              points={months.map(([key, v]) => ({
                label: parseInt(key.slice(5), 10).toString(),
                value: v.income - v.expense,
              }))}
              ariaLabel="Tren neto per bulan"
            />
          </div>
          <div>
            <p className="text-[12.5px] font-medium uppercase tracking-wide text-ink-soft">
              Saldo kumulatif
            </p>
            <LineTren
              points={(() => {
                let akumulasi = 0;
                return months.map(([key, v]) => {
                  akumulasi += v.income - v.expense;
                  return { label: parseInt(key.slice(5), 10).toString(), value: akumulasi };
                });
              })()}
              ariaLabel="Saldo kumulatif 12 bulan"
            />
          </div>
        </div>
        <p className="mt-2 text-[12px] text-ink-soft">
          Neto = masuk − keluar per bulan; saldo kumulatif = akumulasi neto dari 12 bulan lalu hingga bulan terpilih.
        </p>
      </Bagian>

      {/* Komposisi pengeluaran bulan terpilih */}
      <Bagian title={`Komposisi pengeluaran — ${labelBulan(terpilih)}`} className="mt-8">
        {slices.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-line px-6 py-10 text-center text-sm text-ink-soft">
            Belum ada pengeluaran pada bulan ini.
          </div>
        ) : (
          <div className="mt-3 flex flex-col items-center gap-6 sm:flex-row">
            <DonutChart slices={slices} centerTitle="total" centerValue={formatRupiah(totalKeluarTerpilih)} />
            <div className="w-full sm:max-w-sm">
              <BarKategori
                items={catItems.map(([label, value], i) => ({ label, value, color: warnaKategori(i) }))}
              />
            </div>
          </div>
        )}
        <p className="mt-4 text-[13px] text-ink-soft">
          neto bulan ini{" "}
          <span className={"tab-num font-medium " + (netTerpilih >= 0 ? "text-income" : "text-expense")}>
            {netTerpilih >= 0 ? "+" : "−"}
            {formatRupiah(Math.abs(netTerpilih))}
          </span>{" "}
          (masuk {formatRupiah(masukBulanTerpilih)} · keluar {formatRupiah(totalKeluarTerpilih)})
        </p>
      </Bagian>

      {/* Timeline bulan terpilih */}
      {transaksiBulanIni.length > 0 && (
        <Bagian title={`Alur transaksi — ${labelBulan(terpilih)}`} className="mt-8">
          <div className="mt-3">
            <Timeline items={transaksiBulanIni.slice(0, 30)} />
          </div>
        </Bagian>
      )}
    </PageShell>
  );
}

/** Bar chart perbandingan bulanan: dua batang (masuk/keluar) per bulan. */
function PerbandinganBulanan({
  months,
}: {
  months: [string, { income: number; expense: number }][];
}) {
  const max = Math.max(
    1,
    ...months.flatMap(([, v]) => [v.income, v.expense]),
  );
  return (
    <div>
      <div className="mt-3 flex items-end gap-2 sm:gap-3" style={{ height: "150px" }}>
        {months.map(([key, v]) => (
          <div key={key} className="flex flex-1 flex-col items-center gap-1" title={`${labelBulan(key)}\nmasuk ${formatRupiah(v.income)}\nkeluar ${formatRupiah(v.expense)}`}>
            <div className="flex h-full w-full items-end justify-center gap-[2px] sm:gap-0.5">
              <div
                className="w-2 rounded-sm bg-income sm:w-3"
                style={{ height: `${Math.max(v.income > 0 ? 3 : 0, (v.income / max) * 100)}%` }}
              />
              <div
                className="w-2 rounded-sm bg-expense sm:w-3"
                style={{ height: `${Math.max(v.expense > 0 ? 3 : 0, (v.expense / max) * 100)}%` }}
              />
            </div>
            <span className="tab-num text-[10px] text-ink-soft">{parseInt(key.slice(5), 10)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 flex gap-4 text-[12px] text-ink-soft">
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-income align-middle" aria-hidden />pemasukan</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-expense align-middle" aria-hidden />pengeluaran</span>
      </p>
    </div>
  );
}
