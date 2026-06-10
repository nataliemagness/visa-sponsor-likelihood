import { NextResponse } from 'next/server'
import { countCompanies, getSeededAt } from '@/lib/db/store'

export async function GET() {
  return NextResponse.json({
    count: countCompanies(),
    seededAt: getSeededAt(),
  })
}
