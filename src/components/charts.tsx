import { formatRupiah } from "@/lib/format";

export interface Slice {
  label: string;
  value: number;
  color: string; // var(--…)-ref or hex
}

/**
 * Donut chart SVG murni.
 * Menerima slices (label, nilai, warna) dan menampilkan total di tengah.
 */
export function DonutChart({
  slices,
  centerTitle,
  centerValue,
  size = 180,
}: {
  slices: Slice[];
  centerTitle?: string;
  centerValue?: string;
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;

  const r = size / 2;
  const cx = r;
  const cy = r;
  const ringThickness = 14;
  const innerR = r - ringThickness;

  // Hitung sudut kumulatif
  let startAngle = 0; // mulai dari atas (−90°)
  const arcs = slices.map((s) => {
    const frac = s.value / total;
    const sweep = frac * Math.PI * 2;
    const endAngle = startAngle + sweep;
    const path = arcPath(cx, cy, r, startAngle, endAngle, innerR);
    const result = { ...s, path, frac, sweep };
    startAngle = endAngle;
    return result;
  });

  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden="false">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Diagram donat komposisi">
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill={a.color} />
        ))}
      </svg>
      {centerTitle || centerValue ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerTitle ? <span className="text-[12px] uppercase tracking-wide text-ink-soft">{centerTitle}</span> : null}
          {centerValue ? <span className="tab-num text-lg font-semibold">{centerValue}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Buat path SVG untuk sebuah ring (arc) — dari sudut awal ke akhir pada radius luar/dalam.
 */
function arcPath(
  cx: number,
  cy: number,
  outerR: number,
  a0: number,
  a1: number,
  innerR: number,
): string {
  // Offset −90° supaya mulai dari atas
  const o0 = a0 - Math.PI / 2;
  const o1 = a1 - Math.PI / 2;
  const x0 = cx + outerR * Math.cos(o0);
  const y0 = cy + outerR * Math.sin(o0);
  const x1 = cx + outerR * Math.cos(o1);
  const y1 = cy + outerR * Math.sin(o1);
  const ix1 = cx + innerR * Math.cos(o1);
  const iy1 = cy + innerR * Math.sin(o1);
  const ix0 = cx + innerR * Math.cos(o0);
  const iy0 = cy + innerR * Math.sin(o0);
  const large = a1 - a0 > Math.PI ? 1 : 0;

  return [
    `M ${x0.toFixed(3)} ${y0.toFixed(3)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`,
    `L ${ix1.toFixed(3)} ${iy1.toFixed(3)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${ix0.toFixed(3)} ${iy0.toFixed(3)}`,
    "Z",
  ].join(" ");
}

/** Palet warna kategori — terkoordinasi dengan token tema, tetap terbaca di mode gelap. */
export const KWARNA_KATEGORI = [
  "#4f9d6a", // hijau
  "#d97844", // bata
  "#3f8ea3", // biru muda
  "#c9a03c", // kuning
  "#8a6fae", // ungu
  "#c75b8a", // merah muda
  "#6f8a3f", // olive
  "#556b8a", // abu-biru
  "#b5654a", // cokelat
  "#7a8a3a", // chartreuse
  "#444",    // abu gelap
] as const;

/** Urutan warna: assign otomatis per kategori (stable). */
export function warnaKategori(index: number): string {
  return KWARNA_KATEGORI[index % KWARNA_KATEGORI.length];
}

/**
 * Bar chart horisontal per kategori (untuk rincian).
 * Tiap kategori = satu bar, lebar relatif terhadap nilai terbesar.
 */
export function BarKategori({
  items,
}: {
  items: { label: string; value: number; color?: string }[];
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((x) => x.value), 1);
  return (
    <div role="table" aria-label="Rincian per kategori">
      {items.map((x, i) => (
        <div key={i} role="row" className="flex items-center gap-3 py-1.5">
          <span className="w-28 shrink-0 truncate text-[13px]" title={x.label}>
            {x.label}
          </span>
          <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-line/50">
            <div
              className="absolute inset-y-0 left-0 rounded-sm"
              style={{
                width: `${(x.value / max) * 100}%`,
                background: x.color ?? warnaKategori(i),
              }}
            />
            <span className="tab-num absolute inset-0 flex items-center px-2 text-[11px] text-ink mix-blend-difference">
              {formatRupiah(x.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
