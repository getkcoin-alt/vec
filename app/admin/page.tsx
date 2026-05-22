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

export default async function AdminDashboard() {
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Clients</p>
          <p className="text-3xl font-bold text-gray-800">{totalClients}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Credits Outstanding</p>
          <p className="text-3xl font-bold text-blue-600">{totalCredits}</p>
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
