'use client'

import { useState } from 'react'
import type { Client } from '@/lib/supabase'

export default function ApiTester({ clients }: { clients: Client[] }) {
  const [regNo, setRegNo] = useState('')
  const [selectedToken, setSelectedToken] = useState(clients[0]?.token ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ status: number; body: unknown } | null>(null)

  async function runTest() {
    if (!regNo.trim() || !selectedToken) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/v1/vehicle?reg=${encodeURIComponent(regNo.trim())}`, {
        headers: { 'X-API-Key': selectedToken },
      })
      const body = await res.json()
      setResult({ status: res.status, body })
    } catch (err) {
      setResult({ status: 0, body: { error: String(err) } })
    } finally {
      setLoading(false)
    }
  }

  const success = result && result.status === 200 && (result.body as Record<string, unknown>)?.success === true
  const creditUsed = result && (result.body as Record<string, unknown>)?._meta
    ? ((result.body as Record<string, unknown>)._meta as Record<string, unknown>)?.credits_used === 1
    : false

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Test API</h2>

      <div className="flex gap-3 flex-wrap mb-4">
        {/* Reg number input */}
        <input
          type="text"
          value={regNo}
          onChange={e => setRegNo(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && runTest()}
          placeholder="e.g. UP14PT0374"
          className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Client selector */}
        <select
          value={selectedToken}
          onChange={e => setSelectedToken(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {clients.map(c => (
            <option key={c.id} value={c.token}>
              {c.name} ({c.balance} credits)
            </option>
          ))}
        </select>

        <button
          onClick={runTest}
          disabled={loading || !regNo.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Testing…' : 'Run'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-2">
          {/* Status bar */}
          <div className={`flex items-center gap-3 text-xs font-medium px-3 py-2 rounded-t-lg ${
            success ? 'bg-green-50 text-green-700 border border-green-200'
            : result.status === 200 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <span>HTTP {result.status || 'ERR'}</span>
            <span>·</span>
            <span>{success ? 'Success' : 'Failed'}</span>
            {creditUsed && <><span>·</span><span>1 credit deducted</span></>}
            {result.status === 200 && !creditUsed && (
              <><span>·</span><span>No credit deducted</span></>
            )}
          </div>

          {/* JSON body */}
          <pre className="bg-gray-900 text-gray-100 text-xs font-mono rounded-b-lg p-4 overflow-x-auto max-h-96 overflow-y-auto border border-t-0 border-gray-700">
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
