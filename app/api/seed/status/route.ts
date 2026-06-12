import { NextResponse } from 'next/server'
import { countCompanies, getSeededAt } from '@/lib/db/store'

export async function GET() {
  const [count, seededAt] = await Promise.all([countCompanies(), getSeededAt()])
  return NextResponse.json({ count, seededAt })
}
