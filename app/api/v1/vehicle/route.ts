import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Missing X-API-Key header' }, { status: 401 })
  }

  const reg = request.nextUrl.searchParams.get('reg')
  if (!reg) {
    return NextResponse.json({ success: false, error: 'Missing reg parameter' }, { status: 400 })
  }

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, balance')
    .eq('token', apiKey)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 })
  }

  if (client.balance <= 0) {
    return NextResponse.json(
      { success: false, error: 'Insufficient credits' },
      { status: 402 }
    )
  }

  const upstream = await fetch(
    `https://vapi.zeltronaddy.in/v1/vehicle?reg=${encodeURIComponent(reg)}`,
    { headers: { 'X-API-Key': process.env.VAPI_API_KEY! } }
  )

  const data = await upstream.json()

  if (data.success) {
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

    return NextResponse.json({
      success: true,
      regn_no: data.regn_no,
      data: data.data,
      _meta: {
        credits_used: 1,
        credits_remaining: client.balance - 1,
      },
    })
  }

  await supabase.from('lookups').insert({
    client_id: client.id,
    reg_no: reg.toUpperCase(),
    success: false,
  })

  return NextResponse.json({
    ...data,
    _meta: {
      credits_used: 0,
      credits_remaining: client.balance,
    },
  })
}
