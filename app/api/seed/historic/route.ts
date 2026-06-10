import { NextResponse } from 'next/server'
import { runHistoricSeed } from '@/lib/seed-historic'

// Allow up to 5 minutes — XLSX download + 200 CH fetches takes ~2.5 min
export const maxDuration = 300

export async function POST() {
  try {
    const result = await runHistoricSeed({
      chBatchLimit: 200,
      onProgress: msg => console.log('[seed:historic]', msg),
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
