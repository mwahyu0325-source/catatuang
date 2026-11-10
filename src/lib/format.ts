export { formatRupiah } from "./parser"

const TZ = "Asia/Jakarta"

/** "Sen, 10 Nov 2026, 14.30" — zona Asia/Jakarta. */
export function formatTanggal(iso: string, withTime = false): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: TZ,
  }).format(new Date(iso))
}

/** Label relatif ringan: Hari ini / Kemarin / tanggal penuh. */
export function hariRelatif(iso: string): string {
  const d = new Date(iso)
  const tanggal = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(x)
  const hariIni = tanggal(new Date())
  const kemarin = tanggal(new Date(Date.now() - 86_400_000))
  const target = tanggal(d)
  if (target === hariIni) return "Hari ini"
  if (target === kemarin) return "Kemarin"
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(d)
}

/** Kunci hari "2026-11-10" untuk pengelompokan transaksi. */
export function hari(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso))
}
