import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getSupabase, type TransactionRow } from "@/lib/supabase";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { PageShell, Bagian } from "@/components/page-shell";
import { hapusTransaksi, simpanTransaksi } from "../actions";

const KATEGORI_INCOME = ["Gaji", "Bonus", "Investasi", "Transfer Masuk", "Lainnya"];
const KATEGORI_EXPENSE = [
  "Makanan & Minuman", "Transportasi", "Belanja", "Tagihan",
  "Kesehatan", "Hiburan", "Pendidikan", "Rumah", "Donasi", "Lainnya",
];

export const instant = false;

export default async function DetailTransaksiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tersimpan?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await connection();
  const supabase = getSupabase();

  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();
  const t = data as unknown as TransactionRow;

  const lokalInput = (iso: string) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .format(new Date(iso))
      .replace("T", " ")
      .slice(0, 16);

  const kategori = t.type === "income" ? KATEGORI_INCOME : KATEGORI_EXPENSE;
  const inputCls =
    "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm";

  return (
    <PageShell title="Detail transaksi" subtitle={formatTanggal(t.occurred_at, true)}>
      <Bagian title="Ubah" className="mt-0">
        {sp.tersimpan ? (
          <p className="mt-2 rounded-md border border-line bg-income-wash/50 px-3 py-2 text-[13px]" role="status">
            Perubahan tersimpan.
          </p>
        ) : null}

        <form action={simpanTransaksi} className="mt-3 grid grid-cols-1 gap-3">
          <input type="hidden" name="id" value={t.id} />

          <label className="block">
            <span className="text-[13px] text-ink-soft">Jenis</span>
            <select name="type" defaultValue={t.type} className={inputCls + " mt-1"}>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[13px] text-ink-soft">Nominal (Rp)</span>
            <input
              name="amount"
              inputMode="numeric"
              defaultValue={String(t.amount)}
              required
              className={inputCls + " mt-1 tab-num"}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[13px] text-ink-soft">Kategori</span>
              <select name="category" defaultValue={t.category} className={inputCls + " mt-1"}>
                {kategori.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[13px] text-ink-soft">Subkategori</span>
              <input
                name="subcategory"
                defaultValue={t.subcategory ?? ""}
                placeholder="opsional"
                className={inputCls + " mt-1"}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[13px] text-ink-soft">Catatan</span>
            <input name="note" defaultValue={t.note} className={inputCls + " mt-1"} />
          </label>

          <label className="block">
            <span className="text-[13px] text-ink-soft">Waktu (Asia/Jakarta)</span>
            <input
              name="occurred_at"
              type="datetime-local"
              defaultValue={lokalInput(t.occurred_at)}
              className={inputCls + " mt-1 tab-num"}
            />
          </label>

          {t.raw_message ? (
            <p className="text-[12.5px] text-ink-soft">
              Pesan asli Telegram: <span className="rounded bg-line/60 px-1.5 py-0.5 text-ink">{t.raw_message}</span>
            </p>
          ) : null}

          <div className="mt-1 flex items-center gap-3">
            <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
              Simpan
            </button>
            <Link href="/transaksi" className="text-[13px] text-ink-soft hover:text-ink hover:underline">
              Kembali tanpa menyimpan
            </Link>
          </div>
        </form>
      </Bagian>

      <Bagian title="Hapus" className="mt-8">
        <p className="text-[13px] text-ink-soft">
          Transaksi disembunyikan (bisa dibatalkan lewat database). Ringkasan ikut terupdate.
        </p>
        <form action={hapusTransaksi} className="mt-3">
          <input type="hidden" name="id" value={t.id} />
          <button
            type="submit"
            className="rounded-md border border-expense px-4 py-2 text-sm font-medium text-expense hover:bg-expense-wash/60"
          >
            Hapus {formatRupiah(t.amount)}
          </button>
        </form>
      </Bagian>
    </PageShell>
  );
}
