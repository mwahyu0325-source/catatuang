import Link from "next/link";
import { formatRupiah, hariRelatif } from "@/lib/format";
import type { TransactionRow } from "@/lib/supabase";

/** Satu baris transaksi — dipakai di Ringkasan dan Transaksi. */
export function BarisTransaksi({ t }: { t: TransactionRow }) {
  const jam = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })
    .format(new Date(t.occurred_at))
    .replace(":", ".");

  return (
    <li className="flex items-baseline justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm leading-snug">
          {t.note}
          {" "}
          <Link
            href={`/transaksi/${t.id}`}
            className="whitespace-nowrap text-[12px] text-ink-soft hover:text-ink hover:underline"
          >
            ubah
          </Link>
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink-soft">
          {t.category}
          {t.subcategory ? ` · ${t.subcategory}` : ""}
          {" · "}
          <span className="tab-num">{jam}</span>
          {" · "}
          {hariRelatif(t.occurred_at)}
          {t.needs_review ? (
            <span title="Kategori perlu dikoreksi" className="ml-1 text-expense">
              ⚠
            </span>
          ) : null}
        </p>
      </div>
      <p
        className={
          "tab-num shrink-0 text-sm font-medium leading-snug " +
          (t.type === "income" ? "text-income" : "")
        }
      >
        {t.type === "income" ? "+" : "−"}
        {formatRupiah(t.amount)}
      </p>
    </li>
  );
}
