'use client'

import { useState, useTransition } from 'react'
import { addBalance, regenerateToken, deleteClient } from '../actions'
import type { Client } from '@/lib/supabase'

export default function ClientCard({ client }: { client: Client }) {
  const [isPendingBalance, startBalance] = useTransition()
  const [isPendingRegen, startRegen] = useTransition()
  const [isPendingDelete, startDelete] = useTransition()
  const [tokenVisible, setTokenVisible] = useState(false)
  const [liveToken, setLiveToken] = useState(client.token)
  const [copied, setCopied] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [balanceError, setBalanceError] = useState<string | null>(null)

  const maskedToken = liveToken.slice(0, 8) + '••••••••••••••••••••' + liveToken.slice(-4)

  function copyToken() {
    navigator.clipboard.writeText(liveToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleAddBalance(formData: FormData) {
    setBalanceError(null)
    startBalance(async () => {
      const result = await addBalance(client.id, formData)
      if (result?.error) setBalanceError(result.error)
      else setAmountInput('')
    })
  }

  function handleRegen() {
    if (!confirm('Regenerate token? The old token will stop working immediately.')) return
    startRegen(async () => {
      const result = await regenerateToken(client.id)
      if (result && 'token' in result && result.token) {
        setLiveToken(result.token)
        setTokenVisible(true)
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Delete client "${client.name}"? This cannot be undone.`)) return
    startDelete(async () => {
      await deleteClient(client.id)
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{client.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Added {new Date(client.created_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-blue-600">{client.balance}</span>
          <p className="text-xs text-gray-400">credits</p>
        </div>
      </div>

      {/* Token row */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2 mb-4 min-w-0">
        <code className="text-xs text-gray-700 flex-1 truncate font-mono">
          {tokenVisible ? liveToken : maskedToken}
        </code>
        <button
          onClick={() => setTokenVisible((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
          title={tokenVisible ? 'Hide' : 'Show'}
        >
          {tokenVisible ? '🙈' : '👁'}
        </button>
        <button
          onClick={copyToken}
          className="text-xs text-blue-500 hover:text-blue-700 shrink-0 font-medium"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Add credits */}
      <form action={handleAddBalance} className="flex gap-2 mb-3">
        <input
          type="number"
          name="amount"
          min="1"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder="Credits to add"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isPendingBalance}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          {isPendingBalance ? '…' : '+ Add'}
        </button>
      </form>
      {balanceError && <p className="text-red-500 text-xs mb-2">{balanceError}</p>}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={handleRegen}
          disabled={isPendingRegen}
          className="flex-1 text-xs text-amber-600 hover:text-amber-800 disabled:opacity-60 font-medium py-1"
        >
          {isPendingRegen ? 'Regenerating…' : 'Regen Token'}
        </button>
        <button
          onClick={handleDelete}
          disabled={isPendingDelete}
          className="flex-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-60 font-medium py-1"
        >
          {isPendingDelete ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
