import { NextResponse } from 'next/server'
import { runSeed } from '@/lib/seed-register'
import { saveCompanies } from '@/lib/db/store'

export const maxDuration = 120

export async function POST() {
  try {
    const start = Date.now()
    const result = await runSeed()
    saveCompanies(result.companies)

    return NextResponse.json({
      success: true,
      count: result.count,
      skipped: result.skipped,
      csvUrl: result.csvUrl,
      duration: Math.round((Date.now() - start) / 1000),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
