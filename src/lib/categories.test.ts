import { strict as assert } from "node:assert"
import { test } from "node:test"
import { matchRule } from "./categories.ts"

test("kopi → Minuman/Kopi (rule)", () => {
  const r = matchRule("kopi susu pagi", "expense")
  assert.ok(r)
  assert.equal(r.category, "Makanan & Minuman")
  assert.equal(r.subcategory, "Kopi")
  assert.equal(r.matchedBy, "rule")
  assert.equal(r.needsReview, false)
})

test("gaji → pemasukan Gaji", () => {
  const r = matchRule("gaji bulan ini", "income")
  assert.ok(r)
  assert.equal(r.category, "Gaji")
})

test("teks acak → null (perlu AI)", () => {
  assert.equal(matchRule("halo dunia xyzzy", "expense"), null)
})

test("kata kunci lebih spesifik menang", () => {
  const r = matchRule("buku catatan pendidikan anak", "expense")
  assert.ok(r)
  assert.equal(r.category, "Pendidikan")
})
