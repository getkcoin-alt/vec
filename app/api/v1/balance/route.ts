import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withCors, optionsResponse } from '@/lib/cors'

export async function OPTIONS() {
  return optionsResponse()
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) {
    return withCors(NextResponse.json({ success: false, error: 'Missing X-API-Key header' }, { status: 401 }))
  }

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, balance')
    .eq('token', apiKey)
    .single()

  if (error || !client) {
    return withCors(NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 }))
  }

  const { count } = await supabase
    .from('lookups')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .eq('success', true)

  return withCors(NextResponse.json({
    success: true,
    client: client.name,
    calls_used: count ?? 0,
    credits_remaining: client.balance,
  }))
}
