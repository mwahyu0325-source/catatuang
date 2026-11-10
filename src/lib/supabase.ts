import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Client Supabase untuk dipakai di server (route handler / server component).
 * Memakai service role key, jadi JANGAN pernah diimpor dari client component.
 */
let cached: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (cached) return cached

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env.local")
  }

  cached = createClient(url, key, {
    auth: { persistSession: false },
  })
  return cached
}

export interface TransactionRow {
  id: string
  telegram_message_id: number | null
  chat_id: number | null
  type: "income" | "expense"
  amount: number
  category: string
  subcategory: string | null
  note: string
  raw_message: string
  matched_by: string
  confidence: number
  needs_review: boolean
  occurred_at: string
  created_at: string
}
