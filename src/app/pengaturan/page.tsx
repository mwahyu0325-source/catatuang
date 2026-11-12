import { connection } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { getAnggaran, getKategoriEfektif } from "@/lib/settings";
import { formatRupiah } from "@/lib/format";
import { PageShell, Bagian } from "@/components/page-shell";
import {
  simpanAnggaran,
  tambahKataKunciAction,
  tambahKategoriAction,
  hapusKategoriAction,
} from "./actions";

export const instant = false;

const inputCls =
  "rounded-md border border-line bg-surface px-3 py-2 text-sm";

export default async function PengaturanPage() {
  await connection();
  const supabase = getSupabase();

  const [anggaran, kategoriEfektif, dbRows] = await Promise.all([
    getAnggaran(),
    getKategoriEfektif(),
    supabase.from("categories").select("id, name, subcategory, type, keywords"),
  ]);

  const aiAktif = Boolean(process.env.AGNES_API_KEY);
  const botSiap = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const ownerTerset = Boolean(process.env.TELEGRAM_OWNER_ID);

  // Baris DB kustom (punya id → bisa dihapus)
  const dbById = new Map(
    (dbRows.data ?? []).map((r: Record<string, unknown>) => [
      `${r.name}::${r.subcategory ?? ""}::${r.type}`,
      { id: String(r.id), keywords: (r.keywords ?? []) as string[] },
    ]),
  );

  // Kelompokkan kategori pengeluaran per nama (subs + keyword gabungan)
  const expenseRules = new Map<string, { subs: Set<string>; keywords: Set<string>; type: "income" | "expense" }>();
  for (const r of kategoriEfektif) {
    if (!expenseRules.has(r.name)) expenseRules.set(r.name, { subs: new Set(), keywords: new Set(), type: r.type });
    const e = expenseRules.get(r.name)!;
    if (r.sub) e.subs.add(r.sub);
    r.keywords.forEach((k) => e.keywords.add(k));
  }

  const incomeNames = [
    ...new Set(kategoriEfektif.filter((c) => c.type === "income").map((c) => c.name)),
  ];

  return (
    <PageShell title="Pengaturan">
      <Bagian title="Status sistem">
        <dl className="mt-3 space-y-2 text-sm">
          {[
            ["Bot Telegram", botSiap ? "aktif" : "belum dikonfigurasi (isi TELEGRAM_BOT_TOKEN)"],
            ["Batasan pemilik bot", ownerTerset ? "aktif — hanya owner yang bisa input" : "belum diset (isi TELEGRAM_OWNER_ID)"],
            ["Kategorisasi AI (Agnes)", aiAktif ? "aktif — dipakai bila rule kata kunci tidak cocok" : "nonaktif — hanya rule kata kunci"],
            ["Penyimpanan", "Supabase Postgres"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 border-b border-line pb-2 sm:flex-row sm:items-baseline sm:justify-between">
              <dt className="text-ink-soft">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Bagian>

      <Bagian title="Anggaran bulanan" className="mt-8">
        <p className="mt-2 text-[13px] text-ink-soft">
          Bila terisi, dashboard menampilkan progres pengeluaran dan bot memberi peringatan di 80% & 100%.
        </p>
        <form action={simpanAnggaran} className="mt-3 flex items-end gap-3">
          <label className="block flex-1 sm:max-w-xs">
            <span className="text-[13px] text-ink-soft">Batas pengeluaran per bulan (Rp)</span>
            <input
              name="anggaran"
              inputMode="numeric"
              defaultValue={anggaran > 0 ? String(anggaran) : ""}
              placeholder="misal 3000000"
              className={inputCls + " tab-num mt-1 w-full"}
            />
          </label>
          <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
            Simpan
          </button>
        </form>
        {anggaran > 0 ? (
          <p className="mt-2 text-[13px]">Anggaran aktif: <span className="tab-num font-medium">{formatRupiah(anggaran)}</span> per bulan.</p>
        ) : null}
      </Bagian>

      <Bagian title="Tema" className="mt-8">
        <p className="mt-2 text-sm text-ink-soft">
          Tema terang/gelap diubah lewat tombol bulat di kanan atas. Pilihan disimpan di perangkat ini dan mengikuti preferensi sistem bila belum pernah diubah.
        </p>
      </Bagian>

      <Bagian title="Kelola kategori" className="mt-8">
        <details className="mt-2 rounded-lg border border-line bg-surface p-4" open>
          <summary className="cursor-pointer text-sm font-medium">Tambah kategori baru</summary>
          <form action={tambahKategoriAction} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-[13px] text-ink-soft">Nama kategori</span>
              <input name="name" required placeholder="misal Hadiah" className={inputCls + " mt-1 block"} />
            </label>
            <label className="block">
              <span className="text-[13px] text-ink-soft">Jenis</span>
              <select name="type" className={inputCls + " mt-1 block"}>
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
            </label>
            <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm hover:bg-line/40">
              Tambah
            </button>
          </form>
        </details>

        <details className="mt-3 rounded-lg border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">Tambah kata kunci ke kategori</summary>
          <form action={tambahKataKunciAction} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-[13px] text-ink-soft">Kategori</span>
              <select name="name" className={inputCls + " mt-1 block"} required>
                <optgroup label="Pengeluaran">
                  {[...expenseRules.entries()].filter(([, v]) => v.type === "expense").map(([name]) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </optgroup>
                <optgroup label="Pemasukan">
                  {incomeNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="block">
              <span className="text-[13px] text-ink-soft">Subkategori (opsional)</span>
              <input name="sub" placeholder="misal Kopi" className={inputCls + " mt-1 block"} />
            </label>
            <label className="block flex-1 sm:min-w-48">
              <span className="text-[13px] text-ink-soft">Kata kunci</span>
              <input name="keyword" required placeholder="misal cafe" className={inputCls + " mt-1 block w-full"} />
            </label>
            <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm hover:bg-line/40">
              Tambah
            </button>
          </form>
        </details>

        <ul className="mt-5 divide-y divide-line border-t border-line">
          {[...expenseRules.entries()].map(([name, { subs, keywords, type }]) => {
            const db = dbById.get(`${name}::${subs.size === 1 ? [...subs][0] : ""}::${type}`);
            return (
              <li key={name} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">
                    {name}
                    {subs.size > 0 ? <span className="ml-1.5 text-[12.5px] text-ink-soft">({[...subs].join(", ")})</span> : null}
                    <span className="ml-1.5 text-[11px] uppercase tracking-wide text-ink-soft">{type === "income" ? "masuk" : "keluar"}</span>
                  </p>
                  {db ? (
                    <form action={hapusKategoriAction}>
                      <input type="hidden" name="id" value={db.id} />
                      <button type="submit" className="text-[12px] text-expense hover:underline">
                        hapus kustomisasi
                      </button>
                    </form>
                  ) : null}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                  {[...keywords].sort().join(", ") || "—"}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[13px] text-ink-soft">
          Kata kunci dasar (bawaan kode) digabung dengan yang kamu tambahkan di sini. "Hapus kustomisasi" membuang baris dari database, kembali ke bawaan.
        </p>
      </Bagian>

      <Bagian title="Kategori pemasukan" className="mt-8">
        <p className="mt-2 text-sm">{incomeNames.join(" · ")}</p>
        <p className="mt-1 text-[12.5px] text-ink-soft">Subkategori pemasukan (sub untuk Gaji, dll.) ikut rule bawaan: {DEFAULT_CATEGORIES.filter((c) => c.type === "income" && c.sub).map((c) => c.name).join(", ") || "tidak ada"}.</p>
      </Bagian>

      <Bagian title="Data & privasi" className="mt-8">
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>Data hanya milikmu — bot menolak semua Telegram ID selain owner.</li>
          <li>Teks deskripsi transaksi dikirim ke Agnes AI hanya bila rule kata kunci tidak cocok.</li>
          <li>Dashboard tanpa login (keputusan kamu) — jangan bagikan URL halaman ini.</li>
        </ul>
      </Bagian>
    </PageShell>
  );
}
