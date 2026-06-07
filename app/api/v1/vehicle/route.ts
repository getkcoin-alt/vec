import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withCors, optionsResponse } from '@/lib/cors'

const UPSTREAM = 'https://advanced-omega.vercel.app'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) {
    return withCors(NextResponse.json({ success: false, error: 'Missing X-API-Key header' }, { status: 401 }))
  }

  const reg = request.nextUrl.searchParams.get('reg')
  if (!reg) {
    return withCors(NextResponse.json({ success: false, error: 'Missing reg parameter' }, { status: 400 }))
  }

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

  const upstreamRes = await fetch(`${UPSTREAM}/api/vehicle?number=${encodeURIComponent(reg.toUpperCase())}`)
  const body = await upstreamRes.json()

  const mobile = body?.data?.data?.VEHICLE_NUMBER?.mobile
  const charged = typeof mobile === 'string' && mobile.trim().length > 0

  if (charged) {
    await Promise.all([
      supabase.from('clients').update({ balance: client.balance - 1 }).eq('id', client.id),
      supabase.from('lookups').insert({ client_id: client.id, reg_no: reg.toUpperCase(), success: true }),
    ])
  } else {
    await supabase.from('lookups').insert({ client_id: client.id, reg_no: reg.toUpperCase(), success: false })
  }

  return withCors(NextResponse.json({
    ...body,
    _meta: {
      credits_used: charged ? 1 : 0,
      credits_remaining: charged ? client.balance - 1 : client.balance,
    },
  }))
}
