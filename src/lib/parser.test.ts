import { strict as assert } from "node:assert"
import { test } from "node:test"
import { parseAmount, extractDescription, formatRupiah } from "./parser.ts"

test("AC-03 variasi nominal → semuanya 1.500.000", () => {
  for (const input of ["1,5jt", "1.500.000", "Rp 1.500.000", "1500rb", "1,5 jt"]) {
    const result = parseAmount(input)
    assert.equal(result?.value, 1_500_000, `gagal pada: ${input}`)
  }
})

test("AC-01 '6jt' → 6.000.000", () => {
  assert.equal(parseAmount("gaji 6jt")?.value, 6_000_000)
})

test("AC-02 '15rb' → 15.000", () => {
  assert.equal(parseAmount("kopi 15rb")?.value, 15_000)
})

test("nominal tanpa satuan", () => {
  assert.equal(parseAmount("2500")?.value, 2_500)
})

test("angka desimal koma", () => {
  assert.equal(parseAmount("250,5rb")?.value, 250_500)
})

test("nominal tidak ada → null", () => {
  assert.equal(parseAmount("kopi"), null)
  assert.equal(parseAmount(""), null)
})

test("format Rupiah pakai pemisah titik", () => {
  assert.equal(formatRupiah(6_000_000), "Rp6.000.000")
  assert.equal(formatRupiah(15_000), "Rp15.000")
  assert.equal(formatRupiah(0), "Rp0")
  assert.equal(formatRupiah(-2_500), "-Rp2.500")
})

test("deskripsi dibersihkan dari nominal", () => {
  assert.equal(extractDescription("kopi 15rb", "15rb"), "kopi")
  assert.equal(extractDescription("gaji 6jt", "6jt"), "gaji")
  assert.equal(extractDescription("bayar listrik 350rb", "350rb"), "bayar listrik")
})
