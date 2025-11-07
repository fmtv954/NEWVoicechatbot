import { test } from "node:test"
import assert from "node:assert"

test("example test passes", () => {
  assert.strictEqual(1 + 1, 2)
})

test("string concatenation works", () => {
  assert.strictEqual("hello" + " " + "world", "hello world")
})
