import { test } from "node:test"
import assert from "node:assert"
import { cn } from "../lib/utils"

test("cn - basic functionality", () => {
  assert.strictEqual(cn("class1", "class2"), "class1 class2")
  assert.strictEqual(cn("class1"), "class1")
  assert.strictEqual(cn(), "")
})

test("cn - conditional classes", () => {
  assert.strictEqual(cn("base", true && "conditional"), "base conditional")
  assert.strictEqual(cn("base", false && "conditional"), "base")
  assert.strictEqual(cn("base", null), "base")
  assert.strictEqual(cn("base", undefined), "base")
})

test("cn - object syntax", () => {
  assert.strictEqual(cn({ "class1": true, "class2": false }), "class1")
  assert.strictEqual(cn({ "class1": true, "class2": true }), "class1 class2")
  assert.strictEqual(cn({ "class1": false, "class2": false }), "")
})

test("cn - array syntax", () => {
  assert.strictEqual(cn(["class1", "class2"]), "class1 class2")
  assert.strictEqual(cn(["class1", false && "class2"]), "class1")
  assert.strictEqual(cn(["class1", { "class2": true }]), "class1 class2")
})

test("cn - mixed syntax", () => {
  assert.strictEqual(
    cn("base", ["array-class"], { "object-class": true }, false && "conditional"),
    "base array-class object-class"
  )
})

test("cn - tailwind merge functionality", () => {
  // Test that conflicting Tailwind classes are properly merged
  assert.strictEqual(cn("px-2 px-4"), "px-4")
  assert.strictEqual(cn("text-red-500 text-blue-500"), "text-blue-500")
  assert.strictEqual(cn("bg-red-500", "bg-blue-500"), "bg-blue-500")
})

test("cn - empty and whitespace handling", () => {
  assert.strictEqual(cn("", "class"), "class")
  assert.strictEqual(cn("  ", "class"), "class")
  assert.strictEqual(cn("class1", "", "class2"), "class1 class2")
  assert.strictEqual(cn("   class1   ", "   class2   "), "class1 class2")
})