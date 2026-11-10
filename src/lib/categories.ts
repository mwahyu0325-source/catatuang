/**
 * Kategorisasi transaksi:
 * 1. Rule-based berdasarkan kata kunci (cepat, gratis, tanpa kirim data keluar).
 * 2. Fallback ke Gemini API kalau tidak ada rule yang cocok.
 */

export type TransactionType = "income" | "expense"

export interface CategoryRule {
  name: string
  sub?: string
  type: TransactionType
  keywords: string[]
}

export const DEFAULT_CATEGORIES: CategoryRule[] = [
  // Pemasukan
  { name: "Gaji", type: "income", keywords: ["gaji", "salary", "uang masuk kantor"] },
  { name: "Bonus", type: "income", keywords: ["bonus", "thr", "komisi"] },
  { name: "Investasi", type: "income", keywords: ["dividen", "interest", "bunga", "profit crypto", "jual saham"] },
  { name: "Transfer Masuk", type: "income", keywords: ["transfer masuk", "dirimut", "dapat transfer", "dari ibu", "dari ayah"] },
  { name: "Lainnya", type: "income", keywords: [] },

  // Pengeluaran
  { name: "Makanan & Minuman", sub: "Kopi", type: "expense", keywords: ["kopi", "coffee", "starbucks", "janji jiwa", "fore", "cappu", "latte", "espresso"] },
  { name: "Makanan & Minuman", sub: "Makan", type: "expense", keywords: ["makan", "nasi", "warung", "resto", "kebab", "bakso", "mie", "indomie", "sushi", "gofood", "grabfood", "dinner", "sarapan"] },
  { name: "Makanan & Minuman", sub: "Jajan", type: "expense", keywords: ["jajan", "snack", "es krim", "boba", "minum", "es teh", "jus"] },
  { name: "Transportasi", type: "expense", keywords: ["gojek", "grab", "bensin", "pertalite", "pertamax", "tol", "parkir", "ojek", "busway", "krl", "commuter", "kereta", "angkot"] },
  { name: "Belanja", type: "expense", keywords: ["shopee", "tokopedia", "lazada", "belanja", "beli", "baju", "celana", "sepatu", "sneakers"] },
  { name: "Tagihan", type: "expense", keywords: ["listrik", "pln", "pulsa", "indihome", "wifi", "internet", "biznet", "pdam", "air", "cicilan", "netflix", "spotify"] },
  { name: "Kesehatan", type: "expense", keywords: ["klinik", "apotek", "obat", "dokter", "vitamin", "rumah sakit", "gigi", "medical"] },
  { name: "Hiburan", type: "expense", keywords: ["nonton", "bioskop", "game", "playstation", "cgv", "xxi", "konser", "musik", "tiket"] },
  { name: "Pendidikan", type: "expense", keywords: ["kursus", "kelas", "buku", "seminar", "sertifikasi", "toefl"] },
  { name: "Rumah", type: "expense", keywords: ["kos", "kamar", "sewa", "kontrakan", "gas lpg", "deterjen"] },
  { name: "Donasi", type: "expense", keywords: ["donasi", "sedekah", "zakat", "qurban", "charity"] },
  { name: "Lainnya", type: "expense", keywords: [] },
]

export interface CategorizationResult {
  category: string
  subcategory: string | null
  matchedBy: "rule" | "ai" | "fallback"
  confidence: number // 0-1
  needsReview: boolean
}

/** Cari kategori yang cocok berdasarkan kata kunci. */
export function matchRule(text: string, type: TransactionType): CategorizationResult | null {
  const lower = text.toLowerCase()
  let best: { rule: CategoryRule; score: number } | null = null

  for (const rule of DEFAULT_CATEGORIES) {
    if (rule.type !== type) continue
    let score = 0
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        score = Math.max(score, kw.length) // kata kunci yang lebih panjang = lebih spesifik
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { rule, score }
    }
  }

  if (!best) return null
  const category = best.rule.name
  const isNullOrDefault = category === "Lainnya"
  return {
    category,
    subcategory: best.rule.sub ?? null,
    matchedBy: "rule",
    confidence: Math.min(0.6 + best.score / 20, 0.95),
    needsReview: isNullOrDefault,
  }
}

/**
 * Fallback: minta Gemini menentukan kategori.
 * Kembalikan null kalau tidak dikonfigurasi / error → gunakan "Lainnya".
 */
export async function categorizeWithAI(
  description: string,
  type: TransactionType,
): Promise<CategorizationResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || !description) return null

  const categories = DEFAULT_CATEGORIES.filter((c) => c.type === type)
    .map((c) => (c.sub ? `${c.name}/${c.sub}` : c.name))

  const prompt =
    `Kategorikan transaksi ini. Pilih hanya satu dari kategori berikut: ${categories.join(", ")}. ` +
    `Jawab saja dengan nama kategori, tanpa penjelasan tambahan.\n` +
    `Deskripsi transaksi: "${description}"`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 64 },
        }),
      },
    )
    if (!res.ok) return null

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!answer) return null

    // "Makanan & Minuman/Kopi" → cat & sub
    const [catPart, subPart] = answer.split("/").map((s) => s.trim())
    const exact = categories.find(
      (c) => c === answer || c === `${catPart}/${subPart}`,
    )
    if (!exact) return null

    const [category, sub] = exact.split("/")
    return {
      category,
      subcategory: sub ?? null,
      matchedBy: "ai",
      confidence: 0.75,
      needsReview: false,
    }
  } catch {
    return null
  }
}

/** Kategorisasi lengkap: rule dulu, fallback AI, terakhir → "Lainnya". */
export async function categorize(
  description: string,
  type: TransactionType,
): Promise<CategorizationResult> {
  const ruleResult = matchRule(description, type)
  if (ruleResult && ruleResult.confidence >= 0.7) return ruleResult

  const aiResult = await categorizeWithAI(description, type)
  if (aiResult) return aiResult
  if (ruleResult) return ruleResult

  return {
    category: "Lainnya",
    subcategory: null,
    matchedBy: "fallback",
    confidence: 0,
    needsReview: true,
  }
}
