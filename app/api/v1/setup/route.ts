import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  // Check if already exists to prevent duplicates
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('token', '8090')
    .single()

  if (existing) {
    // Just update the balance to 198 if they already exist
    const { error: updateErr } = await supabase
      .from('clients')
      .update({ balance: 198 })
      .eq('token', '8090')
      
    if (updateErr) return NextResponse.json({ error: updateErr.message })
    return NextResponse.json({ success: true, message: 'Nikunj Goyal already existed. Updated balance to 198.' })
  }

  // Create new
  const { error } = await supabase.from('clients').insert({
    name: 'Nikunj Goyal',
    token: '8090',
    balance: 198
  })

  if (error) {
    return NextResponse.json({ error: error.message })
  }

  return NextResponse.json({ success: true, message: 'Successfully created Nikunj Goyal with PIN 8090 and 198 credits!' })
}
