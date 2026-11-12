"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

/** Hapus transaksi (soft delete — sama seperti /undo). */
export async function hapusTransaksi(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = getSupabase();
  await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/");
  revalidatePath("/transaksi");
  revalidatePath("/laporan");
  redirect("/transaksi");
}

/** Simpan perubahan transaksi. */
export async function simpanTransaksi(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const amount = Math.round(Number(String(formData.get("amount") ?? "").replace(/[^\d]/g, "")));
  const type = String(formData.get("type") ?? "expense");
  const category = String(formData.get("category") ?? "Lainnya");
  const subcategoryRaw = String(formData.get("subcategory") ?? "").trim();
  const occurredAt = String(formData.get("occurred_at") ?? "");

  if (!id || !amount || amount <= 0 || !["income", "expense"].includes(type)) return;

  const supabase = getSupabase();
  await supabase
    .from("transactions")
    .update({
      note: note || "tanpa deskripsi",
      amount,
      type,
      category,
      subcategory: subcategoryRaw || null,
      needs_review: false,
      ...(occurredAt ? { occurred_at: new Date(occurredAt).toISOString() } : {}),
    })
    .eq("id", id);

  revalidatePath("/");
  revalidatePath("/transaksi");
  revalidatePath("/laporan");
  redirect(`/transaksi/${id}?tersimpan=1`);
}
