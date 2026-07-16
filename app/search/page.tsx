'use client'

import { useState } from 'react'

export default function UserPortal() {
  const [pin, setPin] = useState('')
  const [token, setToken] = useState('')
  const [clientName, setClientName] = useState('')
  const [balance, setBalance] = useState(0)
  
  const [regNo, setRegNo] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!pin.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/balance', {
        headers: { 'X-API-Key': pin.trim() }
      })
      const data = await res.json()
      if (data.success) {
        setToken(pin.trim())
        setClientName(data.client)
        setBalance(data.credits_remaining)
      } else {
        setError(data.error || 'Invalid PIN')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!regNo.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`/api/v1/vehicle?reg=${encodeURIComponent(regNo.trim())}`, {
        headers: { 'X-API-Key': token }
      })
      const data = await res.json()
      if (res.status === 200 && data.success !== false) {
        setResult(data)
        if (data._meta?.credits_remaining !== undefined) {
          setBalance(data._meta.credits_remaining)
        }
      } else {
        setError(data.error || 'Search failed or no data found.')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    setToken('')
    setPin('')
    setResult(null)
    setError('')
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Enter your PIN to access vehicle search</p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-medium text-gray-700">PIN / Access Token</label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              {error && <div className="text-red-500 text-sm text-center">{error}</div>}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Sign in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Vehicle Search</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, <span className="font-semibold">{clientName}</span>
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {balance} Credits
              </span>
              <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800 font-medium">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <form onSubmit={handleSearch}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number</label>
            <div className="flex gap-4">
              <input
                type="text"
                required
                placeholder="e.g. RJ27UD4410"
                value={regNo}
                onChange={e => setRegNo(e.target.value.toUpperCase())}
                className="flex-1 uppercase border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading || balance <= 0}
                className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {balance <= 0 && <p className="text-red-500 text-xs mt-2">Insufficient credits to perform search.</p>}
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Vehicle Details: {result.registration_number?.toUpperCase()}
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-0">
              <dl className="sm:divide-y sm:divide-gray-200">
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Owner Name</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {result.owner_section?.owner_name || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Mobile Number</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {result.mobile_data?.mobile_number || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Vehicle Make/Model</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {result.vehicle_specifications?.maker_model || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Chassis Number</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">
                    {result.vehicle_specifications?.chassis_number || result.mobile_data?.chassis_number || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Engine Number</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">
                    {result.vehicle_specifications?.engine_number || result.mobile_data?.engine_number || 'N/A'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Address</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {result.owner_section?.present_address || 'N/A'}
                  </dd>
                </div>
              </dl>
              
              <div className="px-4 py-5 sm:px-6 border-t border-gray-200">
                 <details>
                   <summary className="text-sm text-blue-600 cursor-pointer outline-none">View Full Raw JSON</summary>
                   <pre className="mt-3 bg-gray-900 text-gray-100 text-xs font-mono rounded p-4 overflow-x-auto">
                     {JSON.stringify(result, null, 2)}
                   </pre>
                 </details>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
