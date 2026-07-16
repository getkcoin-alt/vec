'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'

export async function addClient(formData: FormData) {
  const name = (formData.get('name') as string)?.trim()
  const customToken = (formData.get('token') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  const token = customToken || ('vrc_' + randomBytes(20).toString('hex'))

  const { error } = await supabase.from('clients').insert({ name, token, balance: 0 })
  if (error) return { error: error.message }

  revalidatePath('/admin')
}

export async function addBalance(clientId: string, formData: FormData) {
  const amount = parseInt(formData.get('amount') as string, 10)
  if (isNaN(amount) || amount <= 0) return { error: 'Enter a positive number' }

  const { data: client, error: fetchErr } = await supabase
    .from('clients')
    .select('balance')
    .eq('id', clientId)
    .single()

  if (fetchErr || !client) return { error: 'Client not found' }

  const { error } = await supabase
    .from('clients')
    .update({ balance: client.balance + amount })
    .eq('id', clientId)

  if (error) return { error: error.message }

  revalidatePath('/admin')
}

export async function regenerateToken(clientId: string) {
  const token = 'vrc_' + randomBytes(20).toString('hex')

  const { error } = await supabase
    .from('clients')
    .update({ token })
    .eq('id', clientId)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { token }
}

export async function deleteClient(clientId: string) {
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) return { error: error.message }
  revalidatePath('/admin')
}
