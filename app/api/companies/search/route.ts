import { NextRequest, NextResponse } from 'next/server'
import { searchCompanies, countCompanies } from '@/lib/db/store'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (await countCompanies() === 0) {
    return NextResponse.json({ results: [] })
  }

  const companies = (await searchCompanies(q, undefined)).slice(0, 8).map((c) => ({
    slug: c.slug,
    name: c.name,
    town: c.town ?? null,
    county: c.county ?? null,
    sponsorRoute: c.sponsorRoute ?? null,
  }))

  return NextResponse.json({ results: companies })
}
