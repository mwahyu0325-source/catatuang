"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import {
  KUNCI_ANGGARAN,
  tambahKataKunci,
  tambahKategori,
  hapusKategoriDb,
} from "@/lib/settings";

export async function simpanAnggaran(formData: FormData) {
  const raw = String(formData.get("anggaran") ?? "").replace(/[^\d]/g, "");
  const nilai = Number(raw);
  await getSupabase()
    .from("settings")
    .upsert({ key: KUNCI_ANGGARAN, value: String(Number.isFinite(nilai) && nilai > 0 ? nilai : 0) });
  revalidatePath("/pengaturan");
  revalidatePath("/");
  revalidatePath("/laporan");
}

export async function tambahKataKunciAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const type = String(formData.get("type") ?? "expense") as "income" | "expense";
  const subRaw = String(formData.get("sub") ?? "").trim();
  const keyword = String(formData.get("keyword") ?? "");
  await tambahKataKunci(name, type, subRaw || null, keyword);
  revalidatePath("/pengaturan");
}

export async function tambahKategoriAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const type = String(formData.get("type") ?? "expense") as "income" | "expense";
  await tambahKategori(name, type);
  revalidatePath("/pengaturan");
}

export async function hapusKategoriAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await hapusKategoriDb(id);
  revalidatePath("/pengaturan");
}
