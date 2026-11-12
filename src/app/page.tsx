import Link from "next/link";
import { connection } from "next/server";
import { getSupabase, type TransactionRow } from "@/lib/supabase";
import { formatRupiah } from "@/lib/format";
import { PageShell, Bagian } from "@/components/page-shell";
import { BarisTransaksi } from "@/components/trans-row";
import { DonutChart, warnaKategori } from "@/components/charts";
import { Timeline } from "@/components/timeline";

interface Row {
  amount: number;
  type: string;
}

async function getData() {
  const supabase = getSupabase();
  const kini = new Date();
  const awalBulan = new Date(
    Date.UTC(kini.getUTCFullYear(), kini.getUTCMonth(), 1),
  ).toISOString();

  const [semua, bulanIni, perluReviewReq, terakhirReq] = await Promise.all([
    supabase.from("transactions").select("type, amount").is("deleted_at", null),
    supabase
      .from("transactions")
      .select("type, amount, category")
      .is("deleted_at", null)
      .gte("occurred_at", awalBulan),
    supabase
      .from("transactions")
      .select("id, note, amount, category, occurred_at")
      .is("deleted_at", null)
      .eq("needs_review", true)
      .order("occurred_at", { ascending: false })
      .limit(5),
    supabase
      .from("transactions")
      .select("id, note, amount, type, category, subcategory, needs_review, occurred_at")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(6),
  ]);

  // Kelompokkan transaksi bulan ini per kategori → komposisi donut
  const byCatBulan = new Map<string, number>();
  let catIdx = 0;
  const warna = new Map<string, string>();
  for (const r of bulanIni.data ?? []) {
    if (r.type !== "expense") continue;
    byCatBulan.set(r.category, (byCatBulan.get(r.category) ?? 0) + Number(r.amount));
    if (!warna.has(r.category)) {
      warna.set(r.category, warnaKategori(catIdx++));
    }
  }
  const slices = [...byCatBulan.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: warna.get(label)! }));

  const total = (rows: Row[] | null, tipe: string) =>
    (rows ?? []).filter((r) => r.type === tipe).reduce((s, r) => s + Number(r.amount), 0);

  return {
    totalIncome: total(semua.data, "income"),
    totalExpense: total(semua.data, "expense"),
    bulanIncome: total(bulanIni.data, "income"),
    bulanExpense: total(bulanIni.data, "expense"),
    perluReview: perluReviewReq.data ?? [],
    terakhir: (terakhirReq.data ?? []) as unknown as TransactionRow[],
    slices,
  };
}

export const instant = false; // halaman data per-request, diblok sampai siap

export default async function RingkasanPage() {
  await connection(); // selalu dirender per-request (data runtime Supabase)
  const d = await getData();
  const saldo = d.totalIncome - d.totalExpense;
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  return (
    <PageShell title="CatatUang" subtitle={tanggal}>
      {/* Saldo hero */}
      <div className="border-t border-line pt-6">
        <p className="text-[13px] uppercase tracking-wide text-ink-soft">
          Saldo (semua waktu)
        </p>
        <p className="tab-num mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
          {formatRupiah(saldo)}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4">
          {[
            ["Masuk bulan ini", d.bulanIncome, "text-income"],
            ["Keluar bulan ini", d.bulanExpense, "text-expense"],
            ["Total masuk", d.totalIncome, ""],
            ["Total keluar", d.totalExpense, ""],
          ].map(([label, value, tone]) => (
            <div key={label as string}>
              <dt className="text-[13px] text-ink-soft">{label}</dt>
              <dd
                className={"tab-num mt-0.5 text-lg font-medium sm:text-xl " + (tone as string)}
              >
                {formatRupiah(Number(value))}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Komposisi pengeluaran bulan ini — donut chart */}
      {d.slices.length > 0 ? (
        <Bagian
          title="Komposisi pengeluaran bulan ini"
          className="mt-8"
          aksi={
            <span className="tab-num text-[13px] text-ink-soft">
              total {formatRupiah(d.bulanExpense)}
            </span>
          }
        >
          <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <DonutChart
              slices={d.slices}
              centerTitle="total"
              centerValue={formatRupiah(d.bulanExpense)}
            />
            <ul className="w-full sm:max-w-sm" aria-label="Legenda komposisi">
              {d.slices.map((s, i) => {
                const persen = Math.round((s.value / d.bulanExpense) * 100);
                return (
                  <li key={s.label} className="flex items-center gap-2.5 py-1">
                    <span
                      aria-hidden
                      className="block h-3 w-3 shrink-0 rounded-sm"
                      style={{ background: s.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{s.label}</span>
                    <span className="tab-num text-[13px] text-ink-soft">{persen}%</span>
                    <span className="tab-num w-24 text-right text-[13px]">{formatRupiah(s.value)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Bagian>
      ) : null}

      {/* Perlu review */}
      {d.perluReview.length > 0 && (
        <Bagian title={`Perlu review · ${d.perluReview.length}`} className="mt-8">
          <p className="text-[13px] text-ink-soft">
            Kategori belum pasti — koreksi lewat tombol kategori di bot Telegram.
          </p>
          <ul className="mt-2 divide-y divide-line border-t border-line">
            {d.perluReview.map((t: Record<string, unknown>) => (
              <li key={String(t.id)} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <span className="truncate">
                  {String(t.note)} <span className="text-ink-soft">· {String(t.category)}</span>
                </span>
                <span className="tab-num shrink-0">{formatRupiah(Number(t.amount))}</span>
              </li>
            ))}
          </ul>
        </Bagian>
      )}

      <Bagian
        title="Transaksi terakhir"
        className="mt-8"
        aksi={
          <Link href="/transaksi" className="text-[13px] text-ink-soft hover:text-ink hover:underline">
            Lihat semua
          </Link>
        }
      >
        {d.terakhir.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-line px-6 py-10 text-center">
            <p className="text-sm">Belum ada transaksi.</p>
            <p className="mt-1.5 text-[13px] text-ink-soft">
              Mulai lewat Telegram: ketik{" "}
              <span className="rounded bg-line/60 px-1.5 py-0.5 text-ink">/out kopi 15rb</span>
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <Timeline items={d.terakhir} />
          </div>
        )}
      </Bagian>
    </PageShell>
  );
}
