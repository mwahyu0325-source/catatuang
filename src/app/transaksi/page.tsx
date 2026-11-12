import { connection } from "next/server";
import { getSupabase, type TransactionRow } from "@/lib/supabase";
import { formatRupiah } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { Timeline } from "@/components/timeline";

const KATEGORI = [
  "Gaji", "Bonus", "Investasi", "Transfer Masuk",
  "Makanan & Minuman", "Transportasi", "Belanja", "Tagihan",
  "Kesehatan", "Hiburan", "Pendidikan", "Rumah", "Donasi", "Lainnya",
];

interface SearchParams {
  q?: string
  tipe?: string
  kategori?: string
  dari?: string
  sampai?: string
  urut?: string
}

export const instant = false; // halaman data per-request, diblok sampai siap

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams;
  await connection(); // selalu dirender per-request
  const supabase = getSupabase();

  let q = supabase
    .from("transactions")
    .select("*")
    .is("deleted_at", null);

  if (sp.q) {
    const ilike = `%${sp.q}%`;
    q = q.or(`note.ilike.${ilike},category.ilike.${ilike},subcategory.ilike.${ilike}`);
  }
  if (sp.tipe === "income" || sp.tipe === "expense") {
    q = q.eq("type", sp.tipe);
  }
  if (sp.kategori && KATEGORI.includes(sp.kategori)) {
    q = q.eq("category", sp.kategori);
  }
  if (sp.dari) q = q.gte("occurred_at", `${sp.dari}T00:00:00+07:00`);
  if (sp.sampai) q = q.lte("occurred_at", `${sp.sampai}T23:59:59+07:00`);

  const urut = sp.urut ?? "terbaru";
  if (urut === "terbesar") q = q.order("amount", { ascending: false });
  else if (urut === "terkecil") q = q.order("amount", { ascending: true });
  else q = q.order("occurred_at", { ascending: false });

  const { data: rows, error } = await q.limit(200);

  // Total sesuai filter (AC-12)
  const masuk = (rows ?? []).filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const keluar = (rows ?? []).filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);

  const items = (rows ?? []) as unknown as TransactionRow[];
  const adaFilter = Boolean(sp.q || sp.tipe || sp.kategori || sp.dari || sp.sampai || sp.urut && sp.urut !== "terbaru");

  return (
    <PageShell title="Transaksi" subtitle={`${items.length} catatan · masuk ${formatRupiah(masuk)} · keluar ${formatRupiah(keluar)}`}>
      {/* Export */}
      <div className="flex justify-end border-t border-line pt-3">
        <a href="/api/export" className="text-[13px] text-ink-soft hover:text-ink hover:underline" download>
          Export CSV
        </a>
      </div>
      {/* Filter — form GET tanpa JS */}
      <form className="grid grid-cols-2 gap-2 border-y border-line py-3 sm:grid-cols-4">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Cari catatan…"
          aria-label="Cari catatan"
          className="col-span-2 rounded-md border border-line bg-surface px-3 py-2 text-sm sm:col-span-2"
        />
        <select name="tipe" defaultValue={sp.tipe ?? ""} aria-label="Tipe" className="rounded-md border border-line bg-surface px-2 py-2 text-sm">
          <option value="">Semua tipe</option>
          <option value="income">Pemasukan</option>
          <option value="expense">Pengeluaran</option>
        </select>
        <select name="kategori" defaultValue={sp.kategori ?? ""} aria-label="Kategori" className="rounded-md border border-line bg-surface px-2 py-2 text-sm">
          <option value="">Semua kategori</option>
          {KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input name="dari" type="date" defaultValue={sp.dari ?? ""} aria-label="Dari tanggal" className="rounded-md border border-line bg-surface px-2 py-2 text-sm" />
        <input name="sampai" type="date" defaultValue={sp.sampai ?? ""} aria-label="Sampai tanggal" className="rounded-md border border-line bg-surface px-2 py-2 text-sm" />
        <select name="urut" defaultValue={urut} aria-label="Urutan" className="rounded-md border border-line bg-surface px-2 py-2 text-sm">
          <option value="terbaru">Terbaru</option>
          <option value="terbesar">Nominal terbesar</option>
          <option value="terkecil">Nominal terkecil</option>
        </select>
        <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-bg hover:opacity-90">
          Terapkan
        </button>
      </form>

      {items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-center">
          <p className="text-sm">{error ? "Gagal memuat data." : adaFilter ? "Tidak ada yang cocok dengan filter." : "Belum ada transaksi."}</p>
        </div>
      ) : (
        <div className="mt-3">
          <Timeline items={items} />
        </div>
      )}
    </PageShell>
  );
}
