# CatatUang

Pencatat keuangan pribadi: input via bot Telegram, baca via dashboard web.

## Struktur

- `src/lib/parser.ts` — parser nominal Rupiah (`6jt`, `15rb`, `1,5jt`) + unit test di `parser.test.ts`
- `src/lib/categories.ts` — kategorisasi rule-based + fallback Gemini API
- `src/lib/supabase.ts` — client Supabase (server-side)
- `src/app/api/telegram/route.ts` — webhook Telegram (`/input`, `/out`, `/saldo`, `/laporan`, `/undo`, `/kategori`)
- `src/app/page.tsx` — dashboard ringkasan
- `src/app/transaksi/page.tsx` — daftar transaksi dengan filter/sort/search
- `src/app/laporan/page.tsx` — grafik 12 bulan + rincian per kategori
- `supabase/schema.sql` — skema database (jalankan di SQL Editor Supabase)

## Setup

1. `npm install`
2. Jalankan `supabase/schema.sql` di Supabase SQL Editor
3. `cp .env.example .env.local`, isi semua nilai
4. `npm run dev`
5. Set webhook bot (sekali saja, ganti `<domain>` & secret):
   ```
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -d "url=https://<domain>/api/telegram" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

## Test parser

```
node --test src/lib/*.test.ts
```

## Catatan keamanan

Dashboard **tanpa login** (keputusan klien). Jangan bagikan URL. Token dan kunci API hanya ada di `.env.local` / environment variables hosting.
