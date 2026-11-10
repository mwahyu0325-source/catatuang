/**
 * Parser nominal Rupiah.
 * Mendukung: "6jt", "15rb", "1,5jt", "1.500.000", "Rp 6.000.000", "1500rb", "2500", "2 juta".
 * Catatan: "1.500" dianggap 1500 rupiah (bukan 1,5 juta).
 */

export interface ParsedAmount {
  value: number
  raw: string
}

const KALI = new Map<string, number>([
  ["rb", 1_000],
  ["ribu", 1_000],
  ["k", 1_000],
  ["jt", 1_000_000],
  ["juta", 1_000_000],
  ["m", 1_000_000_000], // "m" dianggap miliar, sesuai kebiasaan chat
  ["mili", 1_000_000_000],
  ["miliar", 1_000_000_000],
])

/**
 * Baca angka gaya Indonesia: titik/koma sebagai pemisah ribuan 3 digit = ribuan,
 * koma/titik lainnya = desimal.
 */
function parseNumberToken(token: string): number {
  const t = token.replace(/\s+/g, "")

  // Kelompok ribuan penuh: "1.500.000", "1,500,000", "1.500.000,50"
  if (/^-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?$/.test(t)) {
    return Number(t.replace(/[.,]/g, ""))
  }

  // Kombinasi titik + koma: titik = ribuan, koma terakhir = desimal
  if (t.includes(".") && t.includes(",")) {
    const clean = t.replace(/\./g, "").replace(/,/g, ".")
    const n = Number(clean)
    if (Number.isFinite(n)) return n
  }

  // Koma tunggal → desimal ("250,5" → 250,5)
  if (t.includes(",") && !t.includes(".")) {
    const n = Number(t.replace(/,/g, "."))
    if (Number.isFinite(n)) return n
  }

  // Titik tunggal diikuti tepat 3 digit → ribuan ("12.500" → 12500)
  if (/\d[.,]\d{3}$/.test(t)) {
    const n = Number(t.replace(/[.,]/g, ""))
    if (Number.isFinite(n)) return n
  }

  // Selain itu: angka biasa / desimal
  const n = Number(t.replace(/,/g, "."))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Ambil nominal dari potongan teks.
 * Kembalikan null kalau tidak ada nominal yang bisa dibaca parser.
 */
export function parseAmount(text: string): ParsedAmount | null {
  if (!text) return null

  // Bersihkan simbol "Rp" dan spasi berlebih
  const cleaned = text
    .replace(/rp\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  // Pola: angka (boleh berkelompok ribuan) + (opsional) satuan
  const pattern = /([0-9]+(?:[.,][0-9]+)*)\s*(rb|ribu|k|jt|juta|mili|miliar|m)?/gi

  let match: RegExpExecArray | null
  let found: ParsedAmount | null = null

  while ((match = pattern.exec(cleaned)) !== null) {
    const numPart = match[1]
    const unitPart = match[2]?.toLowerCase()

    let value = parseNumberToken(numPart)
    const multiplier = unitPart ? (KALI.get(unitPart) ?? 1) : 1
    value = value * multiplier

    // Nilai harus masuk akal: di atas 0 dan tidak lebih dari 100 miliar
    if (!Number.isFinite(value) || value <= 0 || value > 100_000_000_000) continue

    found = { value, raw: match[0].trim() }
    break // Ambil nominal pertama yang terbaca (format "/out kopi 15rb")
  }

  return found
}

/** Format Rupiah: Rp6.000.000 */
export function formatRupiah(value: number): string {
  const rounded = Math.round(value)
  const denganPemisah = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  const sign = rounded < 0 ? "-" : ""
  return `${sign}Rp${denganPemisah}`
}

/**
 * Bersihkan deskripsi dari perintah.
 * Contoh: "kopi 15rb" → "kopi", "gaji 6jt" → "gaji".
 */
export function extractDescription(text: string, amountText: string): string {
  let desc = text
  if (amountText) {
    const index = text.indexOf(amountText)
    if (index >= 0) {
      desc = (text.slice(0, index) + text.slice(index + amountText.length)).trim()
    }
  }
  return desc.replace(/\s+/g, " ") || "tanpa deskripsi"
}
