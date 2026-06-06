import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withCors, optionsResponse } from '@/lib/cors'

const UPSTREAM = 'https://advanced-omega.vercel.app'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey) {
      return withCors(NextResponse.json({ success: false, error: 'Missing X-API-Key header' }, { status: 401 }))
    }

    const reg = request.nextUrl.searchParams.get('reg')
    if (!reg) {
      return withCors(NextResponse.json({ success: false, error: 'Missing reg parameter' }, { status: 400 }))
    }

    const regNorm = reg.toUpperCase().replace(/[\s-]/g, '')

    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, balance')
      .eq('token', apiKey)
      .single()

    if (clientErr || !client) {
      return withCors(NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 }))
    }

    if (client.balance <= 0) {
      return withCors(NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 402 }))
    }

    let upstreamData: Record<string, unknown>
    try {
      const upstream = await fetch(
        `${UPSTREAM}/api/vehicle?number=${encodeURIComponent(regNorm)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        }
      )
      const text = await upstream.text()
      try {
        upstreamData = JSON.parse(text)
      } catch {
        console.error('Upstream non-JSON:', upstream.status, text.slice(0, 200))
        return withCors(NextResponse.json({ success: false, error: 'Upstream returned invalid response' }, { status: 502 }))
      }
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error('Upstream fetch failed:', msg)
      return withCors(NextResponse.json({ success: false, error: 'Could not reach upstream API', detail: msg }, { status: 502 }))
    }

    // upstream wraps payload: { success, data: { success, regn_no, data: { VEHICLE_NUMBER, response, ... } } }
    const payload = upstreamData.data as Record<string, unknown> | undefined
    const inner = payload?.data as Record<string, unknown> | undefined
    const mobile = (inner?.VEHICLE_NUMBER as Record<string, unknown> | undefined)?.mobile ?? ''
    const hasUsefulData = typeof mobile === 'string' && mobile.trim().length > 0

    if (upstreamData.success && hasUsefulData) {
      await Promise.all([
        supabase.from('clients').update({ balance: client.balance - 1 }).eq('id', client.id),
        supabase.from('lookups').insert({ client_id: client.id, reg_no: regNorm, success: true }),
      ])
      return withCors(NextResponse.json({
        ...payload,
        _meta: { credits_used: 1, credits_remaining: client.balance - 1 },
      }))
    }

    await supabase.from('lookups').insert({ client_id: client.id, reg_no: regNorm, success: false })
    return withCors(NextResponse.json({
      ...payload,
      _meta: { credits_used: 0, credits_remaining: client.balance },
    }))

  } catch (err) {
    console.error('Vehicle route error:', err)
    return withCors(NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 }))
  }
}
