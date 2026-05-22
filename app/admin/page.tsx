import { supabase } from '@/lib/supabase'
import AddClientForm from './_components/AddClientForm'
import ClientCard from './_components/ClientCard'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function logout() {
  'use server'
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  redirect('/admin/login')
}

type UpstreamBalance = {
  user: string
  calls_total: number
  calls_used: number
  calls_remaining: number
}

async function fetchUpstreamBalance(): Promise<{ data: UpstreamBalance | null; error: string | null }> {
  const key = process.env.VAPI_API_KEY
  if (!key) return { data: null, error: 'VAPI_API_KEY env var is not set' }

  try {
    const res = await fetch('https://vapi.zeltronaddy.in/v1/balance', {
      headers: { 'X-API-Key': key },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { data: null, error: `HTTP ${res.status} — ${body.slice(0, 100)}` }
    }
    const data = await res.json()
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export default async function AdminDashboard() {
  const [{ data: clients }, { data: upstream, error: upstreamError }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    fetchUpstreamBalance(),
  ])

  const totalClients = clients?.length ?? 0
  const totalCredits = clients?.reduce((s, c) => s + c.balance, 0) ?? 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Topbar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">VRC Admin</h1>
          <p className="text-sm text-gray-500">Vehicle Registration Checker — Reseller Panel</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5"
          >
            Logout
          </button>
        </form>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Clients</p>
          <p className="text-3xl font-bold text-gray-800">{totalClients}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Credits Issued</p>
          <p className="text-3xl font-bold text-blue-600">{totalCredits}</p>
        </div>

        {/* Upstream balance card */}
        <div className={`bg-white rounded-xl shadow-sm border p-4 col-span-2 sm:col-span-2 ${
          upstream
            ? upstream.calls_remaining <= 10
              ? 'border-red-200 bg-red-50'
              : 'border-green-200 bg-green-50'
            : 'border-gray-200'
        }`}>
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
            Upstream API Balance (vapi.zeltronaddy.in)
          </p>
          {upstream ? (
            <div className="flex items-end gap-6">
              <div>
                <p className={`text-3xl font-bold ${
                  upstream.calls_remaining <= 10 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {upstream.calls_remaining}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">remaining</p>
              </div>
              <div className="text-sm text-gray-500 pb-1 space-y-0.5">
                <p>Used: <span className="font-medium text-gray-700">{upstream.calls_used}</span></p>
                <p>Total: <span className="font-medium text-gray-700">{upstream.calls_total}</span></p>
              </div>
              {upstream.calls_remaining <= 10 && (
                <p className="text-xs text-red-600 font-medium pb-1 ml-auto">⚠ Low balance — top up soon</p>
              )}
            </div>
          ) : (
            <div className="text-sm text-amber-700">
              <p className="font-medium">Blocked by Cloudflare</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Railway&apos;s datacenter IP is blocked by vapi.zeltronaddy.in — check balance manually or ask the provider to whitelist Railway.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add client */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">New Client</h2>
        <AddClientForm />
      </div>

      {/* Client grid */}
      {totalClients === 0 ? (
        <p className="text-center text-gray-400 py-16">No clients yet. Add one above.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients!.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      {/* API docs hint */}
      <div className="mt-10 bg-gray-800 rounded-xl p-5 text-sm text-gray-300">
        <p className="font-semibold text-white mb-2">Client API Endpoints</p>
        <p className="mb-1">
          <span className="text-green-400 font-mono">GET</span>{' '}
          <span className="font-mono">/api/v1/vehicle?reg=RJ60CB7284</span>
          <span className="text-gray-500 ml-2">— lookup (requires X-API-Key)</span>
        </p>
        <p>
          <span className="text-green-400 font-mono">GET</span>{' '}
          <span className="font-mono">/api/v1/balance</span>
          <span className="text-gray-500 ml-2">— check credits (requires X-API-Key)</span>
        </p>
      </div>
    </div>
  )
}
