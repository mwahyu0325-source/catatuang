import { getSupabase } from "@/lib/supabase";
import { DEFAULT_CATEGORIES, type CategoryRule } from "@/lib/categories";

export const KUNCI_ANGGARAN = "anggaran_bulanan";

/** Baca anggaran bulanan (Rp). 0 = tidak diset. */
export async function getAnggaran(): Promise<number> {
  try {
    const { data } = await getSupabase()
      .from("settings")
      .select("value")
      .eq("key", KUNCI_ANGGARAN)
      .maybeSingle();
    const n = Number(data?.value ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Kategori efektif: baris dari tabel `categories` (dikelola dashboard)
 * ditambah rule bawaan sebagai dasar.
 */
export async function getKategoriEfektif(): Promise<CategoryRule[]> {
  const gabung = new Map<string, CategoryRule>();
  const kunci = (c: CategoryRule) => `${c.name}::${c.sub ?? ""}::${c.type}`;

  for (const c of DEFAULT_CATEGORIES) gabung.set(kunci(c), c);

  try {
    const { data } = await getSupabase().from("categories").select("*");
    for (const row of data ?? []) {
      const rule: CategoryRule = {
        name: row.name,
        sub: row.subcategory ?? undefined,
        type: row.type,
        keywords: row.keywords ?? [],
      };
      gabung.set(kunci(rule), rule);
    }
  } catch {
    // tabel belum ada / error → pakai default saja
  }

  return [...gabung.values()];
}

/** Tambah kata kunci ke kategori (upsert baris). */
export async function tambahKataKunci(
  name: string,
  type: "income" | "expense",
  sub: string | null,
  keyword: string,
): Promise<void> {
  const supabase = getSupabase();
  const kw = keyword.trim().toLowerCase();
  if (!kw) return;

  const query = supabase
    .from("categories")
    .select("id, keywords")
    .eq("name", name)
    .eq("type", type);
  const { data: existing } = sub
    ? await query.eq("subcategory", sub).maybeSingle()
    : await query.is("subcategory", null).maybeSingle();

  if (existing) {
    const list: string[] = existing.keywords ?? [];
    if (!list.includes(kw)) {
      await supabase
        .from("categories")
        .update({ keywords: [...list, kw] })
        .eq("id", existing.id);
    }
    return;
  }

  await supabase.from("categories").insert({
    name,
    type,
    subcategory: sub,
    keywords: [kw],
  });
}

/** Tambah kategori baru (tanpa keyword). */
export async function tambahKategori(
  name: string,
  type: "income" | "expense",
): Promise<void> {
  const supabase = getSupabase();
  const nameClean = name.trim();
  if (!nameClean) return;
  const { error } = await supabase.from("categories").insert({
    name: nameClean,
    type,
    subcategory: null,
    keywords: [],
  });
  // Duplikat (unique constraint) → abaikan
  void error;
}

/** Hapus baris kategori kustom dari DB (kembali ke rule bawaan). */
export async function hapusKategoriDb(id: string): Promise<void> {
  await getSupabase().from("categories").delete().eq("id", id);
}
