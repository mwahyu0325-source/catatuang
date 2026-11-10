import { connection } from "next/server";
import { getSupabase, type TransactionRow } from "@/lib/supabase";
import { formatRupiah, hari as labelHari, hariRelatif } from "@/lib/format";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";

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
  const supabase = getSupabase()

  let q = supabase
    .from("transactions")
    .select("*")
    .is("deleted_at", null)

  if (sp.q) {
    const ilike = `%${sp.q}%`
    q = q.or(`note.ilike.${ilike},category.ilike.${ilike},subcategory.ilike.${ilike}`)
  }
  if (sp.tipe === "income" || sp.tipe === "expense") {
    q = q.eq("type", sp.tipe)
  }
  if (sp.kategori && KATEGORI.includes(sp.kategori)) {
    q = q.eq("category", sp.kategori)
  }
  if (sp.dari) q = q.gte("occurred_at", `${sp.dari}T00:00:00+07:00`)
  if (sp.sampai) q = q.lte("occurred_at", `${sp.sampai}T23:59:59+07:00`)

  const urut = sp.urut ?? "terbaru"
  if (urut === "terbesar") q = q.order("amount", { ascending: false })
  else if (urut === "terkecil") q = q.order("amount", { ascending: true })
  else q = q.order("occurred_at", { ascending: false })

  const { data: rows, error } = await q.limit(200)

  // Total sesuai filter (AC-12: total ikut menyesuaikan)
  const masuk = (rows ?? []).filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0)
  const keluar = (rows ?? []).filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0)

  // Kelompokkan per hari untuk tampilan yang lebih mudah dibaca
  const groups: { hari: string; items: TransactionRow[] }[] = []
  for (const t of (rows ?? []) as unknown as TransactionRow[]) {
    const k = labelHari(t.occurred_at)
    const last = groups[groups.length - 1]
    if (last && last.hari === k) last.items.push(t)
    else groups.push({ hari: k, items: [t] })
  }

  const input = (name: string) => ({
    name,
    defaultValue: (sp as Record<string, string | undefined>)[name] ?? "",
  })

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 sm:max-w-3xl sm:px-6">
      <div className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Transaksi</h1>
          <p className="text-[13px] text-ink-soft">Semua catatan masuk & keluar</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block"><MainNav /></div>
          <ThemeToggle />
        </div>
      </div>

      {/* Filter — form GET tanpa JS tambahan */}
      <form className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-6">
        <input
          {...input("q")}
          placeholder="Cari catatan…"
          aria-label="Cari catatan"
          className="col-span-2 rounded-md border border-line bg-bg px-3 py-2 text-sm sm:col-span-2"
        />
        <select {...input("tipe")} aria-label="Tipe" className="rounded-md border border-line bg-bg px-2 py-2 text-sm">
          <option value="">Semua tipe</option>
          <option value="income">Pemasukan</option>
          <option value="expense">Pengeluaran</option>
        </select>
        <select {...input("kategori")} aria-label="Kategori" className="rounded-md border border-line bg-bg px-2 py-2 text-sm">
          <option value="">Semua kategori</option>
          {KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input {...input("dari")} type="date" aria-label="Dari tanggal" className="rounded-md border border-line bg-bg px-2 py-2 text-sm" />
        <input {...input("sampai")} type="date" aria-label="Sampai tanggal" className="rounded-md border border-line bg-bg px-2 py-2 text-sm" />
        <select {...input("urut")} aria-label="Urutan" className="rounded-md border border-line bg-bg px-2 py-2 text-sm">
          <option value="terbaru">Terbaru</option>
          <option value="terbesar">Nominal terbesar</option>
          <option value="terkecil">Nominal terkecil</option>
        </select>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <button type="submit" className="flex-1 rounded-md bg-ink px-3 py-2 text-sm font-medium text-bg hover:opacity-90">
            Terapkan
          </button>
        </div>
      </form>

      <p className="mt-4 text-[13px] text-ink-soft">
        {(rows ?? []).length} transaksi ·
        {" "}<span className="text-income">masuk {formatRupiah(masuk)}</span>
        {" "}· <span className="text-expense">keluar {formatRupiah(keluar)}</span>
      </p>

      {(rows ?? []).length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line p-8 text-center text-ink-soft">
          <p className="text-sm">{error ? "Gagal memuat data." : "Tidak ada transaksi yang cocok dengan filter."}</p>
        </div>
      ) : (
        <main className="mt-2 flex-1 pb-24 sm:pb-12">
          {groups.map((g) => (
            <section key={g.hari}>
              <h2 className="mt-6 text-[13px] font-medium uppercase tracking-wide text-ink-soft">
                {hariRelatifLabel(g.hari)}
              </h2>
              <ul className="mt-1 divide-y divide-line border-t border-line">
                {g.items.map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{t.note}</p>
                      <p className="text-[13px] text-ink-soft">
                        {t.category}{t.subcategory ? ` · ${t.subcategory}` : ""}
                        {t.needs_review ? " · ⚠ perlu review" : ""}
                      </p>
                    </div>
                    <p className={"tab-num shrink-0 text-sm font-medium " + (t.type === "income" ? "text-income" : "")}>
                      {t.type === "income" ? "+" : "−"}{formatRupiah(t.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>
      )}
    </div>
  );
}

function hariRelatifLabel(hariKunci: string): string {
  const hariIni = new Intl.DateTimeFormat("en-CA").format(new Date())
  const kemarin = new Intl.DateTimeFormat("en-CA").format(new Date(Date.now() - 86_400_000))
  if (hariKunci === hariIni) return "Hari ini"
  if (hariKunci === kemarin) return "Kemarin"
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(hariKunci + "T12:00:00"))
}
