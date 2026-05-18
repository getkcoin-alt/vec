'use client'

import { useRef, useState, useTransition } from 'react'
import { addClient } from '../actions'

export default function AddClientForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await addClient(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        ref.current?.reset()
      }
    })
  }

  return (
    <form ref={ref} action={handleSubmit} className="flex gap-3 items-end">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Client Name
        </label>
        <input
          type="text"
          name="name"
          required
          placeholder="e.g. Acme Corp"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
      >
        {isPending ? 'Adding…' : 'Add Client'}
      </button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </form>
  )
}
