import { NextRequest } from "next/server"
import { parseAmount, extractDescription, formatRupiah } from "@/lib/parser"
import { categorize } from "@/lib/categories"
import { getSupabase } from "@/lib/supabase"

const OWNER_ID = Number(process.env.TELEGRAM_OWNER_ID ?? 0)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number }
    from?: { id: number; username?: string }
    text?: string
  }
  callback_query?: {
    id: string
    from: { id: number }
    data?: string // "fix:<transaction_id>:<category>/<subcategory>"
  }
}

async function reply(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  })
}

async function replyWithCategoryButtons(
  chatId: number,
  text: string,
  transactionId: string,
  type: "income" | "expense",
) {
  const { DEFAULT_CATEGORIES } = await import("@/lib/categories")
  const names = [...new Set(DEFAULT_CATEGORIES.filter((c) => c.type === type).map((c) => c.name))]
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [
          names.slice(0, 5).map((n) => ({ text: n, callback_data: `fix:${transactionId}:${n}` })),
          [{ text: "✏️ Lainnya…", callback_data: `fixall:${transactionId}` }],
        ],
      },
    }),
  })
}

/** Format pesan konfirmasi sesuai AC-01/02/05. */
function confirmationText(args: {
  note: string
  type: "income" | "expense"
  amount: number
  category: string
  subcategory: string | null
  needsReview: boolean
}): string {
  const label = args.type === "income" ? "Pemasukan" : "Pengeluaran"
  const saldo = `${formatRupiah(args.amount)}`
  const sub = args.subcategory ? ` → ${args.subcategory}` : ""
  const review = args.needsReview ? "\n⚠️ Kategori mungkin belum tepat — tekan tombol di bawah untuk koreksi." : ""
  return `${label} tercatat: ${saldo}\n` + `Kategori: ${args.category}${sub}\n` + `Catatan: ${args.note}` + review
}

async function handleTransaction(comstr: string, message: TelegramUpdate["message"]) {
  if (!message) return
  const type = comstr === "/input" ? ("income" as const) : ("expense" as const)
  const text = (message.text ?? "").trim()

  if (text.length <= comstr.length + 1) {
    await reply(
      message.chat.id,
      FORMAT_HELP,
    )
    return
  }

  const body = text.slice(comstr.length).trim()
  const amount = parseAmount(body)
  if (!amount) {
    // AC-04: nominal tidak valid → panduan format, tidak menyimpan
    await reply(message.chat.id, `Nominal tidak terbaca dari: "${body}".\n\n` + FORMAT_HELP)
    return
  }

  const note = extractDescription(body, amount.raw)
  const cat = await categorize(note, type)

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      type,
      amount: amount.value,
      category: cat.category,
      subcategory: cat.subcategory,
      note,
      raw_message: text,
      matched_by: cat.matchedBy,
      confidence: cat.confidence,
      needs_review: cat.needsReview,
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) {
    // Idempotensi (AC-08): pesan yang sama dikirim ulang → sudah ada
    if (error.code === "23505") {
      await reply(message.chat.id, "Transaksi ini sudah pernah dicatat, tidak disimpan ulang.")
    } else {
      console.error("Gagal simpan:", error)
      await reply(message.chat.id, "Maaf, gagal menyimpan transaksi. Coba lagi.")
    }
    return
  }

  await replyWithCategoryButtons(message.chat.id, confirmationText({
    note,
    type,
    amount: amount.value,
    category: cat.category,
    subcategory: cat.subcategory,
    needsReview: cat.needsReview,
  }), data.id, type)
}

const FORMAT_HELP = [
  "<b>Panduan format input</b>",
  "",
  "/input gaji 6jt → pemasukan Rp6.000.000",
  "/out kopi 15rb → pengeluaran Rp15.000",
  "/out bayar listrik 3.500.000",
  "/out makan 250,5rb",
  "",
  "Satuan yang dimengerti: rb / ribu / k (×1.000), jt / juta (×1.000.000), m / miliar (×1 miliar).",
  "Perintah lain: /saldo, /laporan, /undo, /kategori",
].join("\n")

async function handleCommand(text: string, message: TelegramUpdate["message"]) {
  if (!message) return
  const chatId = message.chat.id

  if (text === "/start") {
    await reply(
      chatId,
      "<b>CatatUang</b> — pencatat keuangan pribadi.\n\n" +
        "Catat pemasukan: <code>/input gaji 6jt</code>\n" +
        "Catat pengeluaran: <code>/out kopi 15rb</code>\n\n" + FORMAT_HELP,
    )
    return
  }

  if (text === "/help") {
    await reply(chatId, FORMAT_HELP)
    return
  }

  if (text === "/saldo") {
    const supabase = getSupabase()
    const { data } = await supabase
      .from("transactions")
      .select("type, amount")
      .is("deleted_at", null)
    const income = (data ?? []).filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0)
    const expense = (data ?? []).filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0)
    await reply(
      chatId,
      `Total pemasukan : ${formatRupiah(income)}\n` +
        `Total pengeluaran: ${formatRupiah(expense)}\n` +
        `Saldo            : <b>${formatRupiah(income - expense)}</b>`,
    )
    return
  }

  if (text === "/kategori") {
    const { DEFAULT_CATEGORIES } = await import("@/lib/categories")
    const income = DEFAULT_CATEGORIES.filter((c) => c.type === "income").map((c) => c.name)
    const expense = [...new Set(DEFAULT_CATEGORIES.filter((c) => c.type === "expense").map((c) => c.name))]
    await reply(
      chatId,
      `<b>Pemasukan:</b> ${income.join(", ")}\n\n<b>Pengeluaran:</b> ${expense.join(", ")}`,
    )
    return
  }

  if (text === "/undo") {
    const supabase = getSupabase()
    const { data: last, error } = await supabase
      .from("transactions")
      .select("id, note, amount, type")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !last) {
      await reply(chatId, "Tidak ada transaksi untuk dibatalkan.")
      return
    }
    await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", last.id)
    await reply(chatId, `Dibatalkan: ${last.type === "income" ? "Pemasukan" : "Pengeluaran"} ${formatRupiah(Number(last.amount))} (${last.note})`)
    return
  }

  if (text === "/laporan") {
    const supabase = getSupabase()
    const now = new Date()
    const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const { data } = await supabase
      .from("transactions")
      .select("type, amount, category")
      .is("deleted_at", null)
      .gte("occurred_at", firstOfMonth)

    const byCategory = new Map<string, number>()
    let income = 0
    let expense = 0
    for (const row of data ?? []) {
      if (row.type === "income") {
        income += Number(row.amount)
      } else {
        expense += Number(row.amount)
        byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + Number(row.amount))
      }
    }
    const lines = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => `• ${cat}: ${formatRupiah(total)}`)
    await reply(
      chatId,
      `<b>Laporan bulan ini</b>\n` +
        `Masuk : ${formatRupiah(income)}\n` +
        `Keluar: ${formatRupiah(expense)}\n\n` +
        (lines.length ? `<b>Pengeluaran per kategori</b>\n${lines.join("\n")}` : "Belum ada pengeluaran bulan ini."),
    )
    return
  }
}

export async function POST(request: NextRequest) {
  // Verifikasi secret header dari Telegram (mitigasi token bocor)
  if (WEBHOOK_SECRET && request.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 })
  }

  if (!USER_ALLOWED()) {
    return Response.json({ ok: true })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return new Response("bad request", { status: 400 })
  }

  // Tolak selain owner (AC-07)
  const sender = update.message?.from?.id ?? update.callback_query?.from.id
  if (!sender || (OWNER_ID && sender !== OWNER_ID)) {
    return Response.json({ ok: true })
  }

  if (update.callback_query) {
    await handleCallback(update)
    return Response.json({ ok: true })
  }

  const text = (update.message?.text ?? "").trim()
  if (text.startsWith("/input ")) {
    await handleTransaction("/input", update.message)
  } else if (text.startsWith("/out ")) {
    await handleTransaction("/out", update.message)
  } else if (["/start", "/help", "/saldo", "/laporan", "/undo", "/kategori"].includes(text)) {
    await handleCommand(text, update.message)
  } else {
    return Response.json({ ok: true })
  }

  return Response.json({ ok: true })
}

function USER_ALLOWED(): boolean {
  return Boolean(BOT_TOKEN && BOT_TOKEN.length > 0)
}

async function handleCallback(update: TelegramUpdate) {
  const cq = update.callback_query
  if (!cq?.data) return
  const [action, id, value] = cq.data.split(":")
  const supabase = getSupabase()

  if (action === "fix" && id) {
    const [category, subcategory] = value?.split("/") ?? [""]
    const { error } = await supabase
      .from("transactions")
      .update({ category, subcategory: subcategory ?? null, needs_review: false })
      .eq("id", id)
    if (!error) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cq.id, text: `Kategori diset: ${category}` }),
      })
    }
    return
  }

  if (action.startsWith("fixall") && id) {
    // Fase 2: daftar kategori lengkap via deeplink dashboard
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: cq.id,
        text: "Koreksi lengkap lewat dashboard (fase 2).",
        show_alert: true,
      }),
    })
  }
}
