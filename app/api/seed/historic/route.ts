import { NextResponse } from 'next/server'
import { runHistoricSeed } from '@/lib/seed-historic'

// Allow up to 5 minutes — XLSX download (~40s) + 300 CH fetches (~236s) ≈ 276s
export const maxDuration = 300

export async function POST() {
  try {
    const result = await runHistoricSeed({
      chBatchLimit: 300,
      onProgress: msg => console.log('[seed:historic]', msg),
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
