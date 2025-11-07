import { redirect } from "next/navigation"

export default function DemoPage() {
  // Use the hardcoded demo campaign ID from 04_seed.sql
  redirect("/a/c0000000-0000-0000-0000-000000000001")
}
