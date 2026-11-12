import { formatRupiah } from "@/lib/format";

export interface Poin {
  label: string; // label sumbu-x, mis. "Nov"
  value: number; // nilai (Rp)
}

/**
 * Line/area chart SVG murni untuk tren bulanan (neto atau saldo kumulatif).
 * Tanpa library — ringan. Nilai tekan (hover) via title SVG asli.
 */
export function LineTren({
  points,
  height = 150,
  area = true,
  ariaLabel = "Grafik tren",
  formatNilai = (v: number) => formatRupiah(v),
}: {
  points: Poin[];
  height?: number;
  area?: boolean;
  ariaLabel?: string;
  formatNilai?: (v: number) => string;
}) {
  const n = points.length;
  if (n < 2) {
    return (
      <div className="rounded-lg border border-dashed border-line px-6 py-8 text-center text-sm text-ink-soft">
        Data belum cukup untuk digambar tren (butuh minimal 2 bulan).
      </div>
    );
  }

  const W = 320;
  const H = height;
  const padX = 8;
  const padY = 12;
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2);
  const y = (v: number) => padY + (1 - (v - min) / range) * (H - padY * 2);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const areaPath = `${line} L ${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const netoNegatif = values[values.length - 1] < 0;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      >
        {/* Garis nol */}
        <line
          x1={padX}
          x2={W - padX}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--line)"
          strokeWidth="1"
        />
        {area && (
          <path
            d={areaPath}
            fill={netoNegatif ? "var(--expense-wash)" : "var(--income-wash)"}
          />
        )}
        <path
          d={line}
          fill="none"
          stroke={netoNegatif ? "var(--expense)" : "var(--income)"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="3" fill="var(--bg)" stroke={netoNegatif ? "var(--expense)" : "var(--income)"} strokeWidth="1.5" />
            <title>{`${p.label}: ${formatNilai(p.value)}`}</title>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
        {points.map((p, i) => (
          <span key={i} className="flex-1 text-center">
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
