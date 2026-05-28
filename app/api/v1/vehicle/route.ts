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

    // Validate client
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

    // Call upstream
    let upstreamData: Record<string, unknown>
    try {
      const upstream = await fetch(
        `${UPSTREAM}/api/vehicle?number=${encodeURIComponent(reg)}`,
        { signal: AbortSignal.timeout(15000) }
      )
      const text = await upstream.text()
      try {
        upstreamData = JSON.parse(text)
      } catch {
        console.error('Upstream non-JSON response:', upstream.status, text.slice(0, 200))
        return withCors(NextResponse.json(
          { success: false, error: 'Upstream API returned invalid response', status: upstream.status },
          { status: 502 }
        ))
      }
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error('Upstream fetch failed:', msg)
      return withCors(NextResponse.json(
        { success: false, error: 'Could not reach upstream API', detail: msg },
        { status: 502 }
      ))
    }

    // Only charge if core fields are actually populated
    const data = upstreamData.data as Record<string, unknown> | undefined
    const ownerName = data?.Owner_Name ?? data?.owner_name ?? ''
    const makerName = data?.Make_Name ?? data?.maker_name ?? ''
    const hasUsefulData = typeof ownerName === 'string' && ownerName.trim().length > 0
      || typeof makerName === 'string' && makerName.trim().length > 0

    if (upstreamData.success && hasUsefulData) {
      await Promise.all([
        supabase
          .from('clients')
          .update({ balance: client.balance - 1 })
          .eq('id', client.id),
        supabase.from('lookups').insert({
          client_id: client.id,
          reg_no: reg.toUpperCase(),
          success: true,
        }),
      ])

      return withCors(NextResponse.json({
        success: true,
        regn_no: upstreamData.regn_no,
        data: upstreamData.data,
        _meta: {
          credits_used: 1,
          credits_remaining: client.balance - 1,
        },
      }))
    }

    await supabase.from('lookups').insert({
      client_id: client.id,
      reg_no: reg.toUpperCase(),
      success: false,
    })

    return withCors(NextResponse.json({
      ...upstreamData,
      _meta: {
        credits_used: 0,
        credits_remaining: client.balance,
      },
    }))

  } catch (err) {
    console.error('Vehicle route error:', err)
    return withCors(NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    ))
  }
}
