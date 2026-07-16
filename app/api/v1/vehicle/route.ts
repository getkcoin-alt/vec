import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withCors, optionsResponse } from '@/lib/cors'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const VAPI_URL = 'https://vapi-lime-ten.vercel.app'
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

  const regUpper = encodeURIComponent(reg.toUpperCase())

  const [numBody, vapiRes] = await Promise.all([
    execFileAsync('python3', ['num.py', reg.toUpperCase(), '--no-proxy'])
      .then(({ stdout }) => JSON.parse(stdout))
      .catch((e) => {
        console.error('Python script error:', e);
        return {};
      }),
    fetch(`${VAPI_URL}/vehicle/full-details?rc=${regUpper}`).catch(() => null)
  ])

  const vapiBody = vapiRes ? await vapiRes.json().catch(() => ({})) : {}
  if (vapiBody.metadata) {
    delete vapiBody.metadata
  }

  const mobile = numBody?.mobile_number || vapiBody?.owner_section?.mobile_number
  const charged = typeof mobile === 'string' && mobile.trim().length > 0

  const body = {
    ...vapiBody,
    mobile_data: numBody,
    success: vapiBody?.success || numBody?.success || false
  }

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
