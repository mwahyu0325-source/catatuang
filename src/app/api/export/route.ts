import { getSupabase, type TransactionRow } from "@/lib/supabase";
import { hari } from "@/lib/format";

/**
 * Export semua transaksi sebagai CSV (dipakai di /transaksi → link "Export CSV").
 * Pemisah koma, UTF-8, header id,type,amount,category,subcategory,note,occurred_at.
 */
export async function GET() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("transactions")
    .select("id, type, amount, category, subcategory, note, occurred_at")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false });

  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows: string[] = [
    "id,type,amount,category,subcategory,note,occurred_at",
    ...((data ?? []) as unknown as (TransactionRow & { subcategory: string | null })[]).map((t) =>
      [t.id, t.type, t.amount, esc(t.category), esc(t.subcategory), esc(t.note), t.occurred_at].join(","),
    ),
  ];

  return new Response("\uFEFF" + rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="catatuang-${hari(new Date().toISOString())}.csv"`,
    },
  });
}
