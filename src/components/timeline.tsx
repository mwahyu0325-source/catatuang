import { formatRupiah, hariRelatif } from "@/lib/format";
import type { TransactionRow } from "@/lib/supabase";

/**
 * Timeline vertikal: titik per hari + garis penghubung.
 * Dipakai di dashboard ringkasan / laporan.
 */
export function Timeline({ items }: { items: TransactionRow[] }) {
  if (items.length === 0) return null;

  // Kelompokkan per hari (Asia/Jakarta), transaksi terbaru di atas
  const groups: { hari: string; items: TransactionRow[] }[] = [];
  for (const t of items) {
    const k = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(t.occurred_at));
    const last = groups[groups.length - 1];
    if (last && last.hari === k) last.items.push(t);
    else groups.push({ hari: k, items: [t] });
  }

  return (
    <ol className="relative ml-2 border-l-2 border-line/70">
      {groups.map((g, gi) => {
        const label =
          g.hari === hariRelatifKey()
            ? "Hari ini"
            : g.hari === hariRelatifKey(1)
              ? "Kemarin"
              : new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(g.hari + "T12:00:00"));
        return (
          <li key={g.hari} className="relative mb-5 pl-5">
            {/* Titik */}
            <span
              aria-hidden
              className="absolute -left-[7px] top-0.5 block h-3 w-3 rounded-full border-2 border-bg bg-income"
            />
            <h3 className="text-[12.5px] font-medium uppercase tracking-wide text-ink-soft">{label}</h3>
            <ul className="mt-1.5">
              {g.items.map((t, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {t.note}
                    <span className="ml-1.5 text-[12px] text-ink-soft">
                      {t.category}
                      {t.subcategory ? ` · ${t.subcategory}` : ""}
                    </span>
                  </span>
                  <span
                    className={
                      "tab-num shrink-0 text-[13px] font-medium " +
                      (t.type === "income" ? "text-income" : "text-expense")
                    }
                  >
                    {t.type === "income" ? "+" : "−"}
                    {formatRupiah(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** Kunci hari ke-n yang lalu (format YYYY-MM-DD). */
function hariRelatifKey(n = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(Date.now() - n * 86_400_000),
  );
}
