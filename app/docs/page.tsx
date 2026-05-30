import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Docs — Vehicle Registration Checker',
  description: 'API reference for the Vehicle Registration Checker lookup service.',
}

const BASE = 'https://vec-production-4764.up.railway.app'

function Badge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded mr-2 ${
      method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
    }`}>
      {method}
    </span>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-gray-100 text-gray-800 text-sm font-mono px-1.5 py-0.5 rounded">
      {children}
    </code>
  )
}

function Block({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 text-gray-100 text-sm font-mono rounded-lg p-4 overflow-x-auto whitespace-pre">
      {children}
    </pre>
  )
}

export default function DocsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-gray-800">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Vehicle Registration API</h1>
        <p className="text-gray-500">
          Look up Indian vehicle registration details by number plate. Pay-per-call — 1 credit per successful lookup.
        </p>
      </div>

      {/* Base URL */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Base URL</h2>
        <Block>{BASE}</Block>
      </section>

      {/* Auth */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Authentication</h2>
        <p className="text-gray-600 mb-3">
          All endpoints require your API key in the <Code>X-API-Key</Code> request header.
        </p>
        <Block>{`X-API-Key: vrc_your_api_key_here`}</Block>
        <p className="text-sm text-gray-400 mt-2">
          Contact the administrator to get your API key and credits.
        </p>
      </section>

      {/* Billing */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Billing</h2>
        <ul className="text-gray-600 space-y-1 list-disc list-inside">
          <li>1 credit is deducted per <strong>successful</strong> lookup.</li>
          <li>Failed lookups (vehicle not found) are <strong>not charged</strong>.</li>
          <li>Requests rejected due to invalid key or insufficient credits are not charged.</li>
        </ul>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* Endpoint 1 */}
      <section className="mb-12">
        <div className="flex items-center mb-1">
          <Badge method="GET" />
          <span className="font-mono text-base font-semibold">/api/v1/vehicle</span>
        </div>
        <p className="text-gray-600 mb-5">
          Look up full registration details for an Indian vehicle number plate.
        </p>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Query Parameters</h3>
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-5">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-600">Parameter</th>
                <th className="px-4 py-2 font-medium text-gray-600">Type</th>
                <th className="px-4 py-2 font-medium text-gray-600">Required</th>
                <th className="px-4 py-2 font-medium text-gray-600">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="px-4 py-2 font-mono text-blue-700">reg</td>
                <td className="px-4 py-2 text-gray-500">string</td>
                <td className="px-4 py-2 text-gray-500">Yes</td>
                <td className="px-4 py-2 text-gray-600">
                  Vehicle registration number. Spaces and hyphens are stripped automatically.
                  <br />
                  <span className="text-gray-400 text-xs">e.g. RJ60CB7284, MH12AB1234</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Example Request</h3>
        <Block>{`curl -X GET "${BASE}/api/v1/vehicle?reg=RJ60CB7284" \\
  -H "X-API-Key: vrc_your_api_key_here"`}</Block>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mt-5 mb-2">
          Response — Success <span className="text-green-600 font-normal normal-case text-xs ml-1">HTTP 200</span>
        </h3>
        <Block>{`{
  "success": true,
  "regn_no": "UP16EJ4689",
  "data": {
    "owner_name": "CHOTU MUKHIYA",
    "owner_number": "1",
    "mobile_number": "",
    "permanent_address": "BOX NO,B33, CHIJARSI S, NOIDA, Gautam Buddha Nagar, Uttar Pradesh",
    "present_address": "BOX NO,B33, CHIJARSI S, NOIDA, Gautam Buddha Nagar, Uttar Pradesh",
    "registration_date": "2024-06-10",
    "fit_up_to": "2039-06-09",
    "registered_at": "Noida, Uttar Pradesh",
    "rto_code": "",
    "rc_status": "ACTIVE",
    "maker_description": "HERO MOTOCORP LTD",
    "maker_model": "DESTINI 125 LX",
    "variant": null,
    "body_type": "SOLO WITH PILLION",
    "vehicle_category_description": "M-Cycle/Scooter(2WN)",
    "fuel_type": "PETROL",
    "color": "PANTHER BLACK",
    "cubic_capacity": "124.60",
    "seat_capacity": "2",
    "wheelbase": "1245",
    "unladen_weight": "115",
    "vehicle_gross_weight": "245",
    "norms_type": "BHARAT STAGE VI",
    "vehicle_chasi_number": "MBLJFN231PGL01031",
    "vehicle_engine_number": "JF17ENPGL05863",
    "manufacturing_date": "11/2023",
    "insurance_company": "National Insurance Co. Ltd.",
    "insurance_policy_number": "39010231246200096712",
    "insurance_upto": "2029-06-06",
    "financer": "L & T FINANCE LTD.",
    "financed": true,
    "blacklist_status": "",
    "challan_details": null
  },
  "_meta": {
    "credits_used": 1,
    "credits_remaining": 49
  }
}`}</Block>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mt-5 mb-2">
          Response — Not Found <span className="text-yellow-600 font-normal normal-case text-xs ml-1">HTTP 200 · 0 credits deducted</span>
        </h3>
        <Block>{`{
  "success": false,
  "message": "No record found",
  "_meta": {
    "credits_used": 0,
    "credits_remaining": 49
  }
}`}</Block>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* Endpoint 2 */}
      <section className="mb-12">
        <div className="flex items-center mb-1">
          <Badge method="GET" />
          <span className="font-mono text-base font-semibold">/api/v1/balance</span>
        </div>
        <p className="text-gray-600 mb-5">
          Check your remaining credits and total successful lookups.
        </p>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Example Request</h3>
        <Block>{`curl -X GET "${BASE}/api/v1/balance" \\
  -H "X-API-Key: vrc_your_api_key_here"`}</Block>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mt-5 mb-2">
          Response <span className="text-green-600 font-normal normal-case text-xs ml-1">HTTP 200</span>
        </h3>
        <Block>{`{
  "success": true,
  "client": "Acme Corp",
  "calls_used": 12,
  "credits_remaining": 38
}`}</Block>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* Errors */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Error Responses</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-600">HTTP Status</th>
                <th className="px-4 py-2 font-medium text-gray-600">error</th>
                <th className="px-4 py-2 font-medium text-gray-600">Cause</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2 font-mono text-gray-700">400</td>
                <td className="px-4 py-2 text-gray-600">Missing reg parameter</td>
                <td className="px-4 py-2 text-gray-500">No <Code>reg</Code> query param provided</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-gray-700">401</td>
                <td className="px-4 py-2 text-gray-600">Missing X-API-Key header</td>
                <td className="px-4 py-2 text-gray-500">Header not sent</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-gray-700">401</td>
                <td className="px-4 py-2 text-gray-600">Invalid API key</td>
                <td className="px-4 py-2 text-gray-500">Key not recognised</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-gray-700">402</td>
                <td className="px-4 py-2 text-gray-600">Insufficient credits</td>
                <td className="px-4 py-2 text-gray-500">Balance is 0 — top up required</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mt-5 mb-2">Error shape</h3>
        <Block>{`{
  "success": false,
  "error": "Insufficient credits"
}`}</Block>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* Format notes */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Registration Number Format</h2>
        <p className="text-gray-600 mb-3">
          Standard Indian format: <strong>State code + RTO code + series + number</strong>.
          Spaces and hyphens are stripped automatically before the lookup.
        </p>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-600">Input</th>
                <th className="px-4 py-2 font-medium text-gray-600">Treated as</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['RJ60CB7284', 'RJ60CB7284'],
                ['RJ-60-CB-7284', 'RJ60CB7284'],
                ['MH 12 AB 1234', 'MH12AB1234'],
                ['DL 01 CAB 1234', 'DL01CAB1234'],
              ].map(([input, treated]) => (
                <tr key={input}>
                  <td className="px-4 py-2 font-mono text-gray-700">{input}</td>
                  <td className="px-4 py-2 font-mono text-gray-500">{treated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="text-center text-xs text-gray-400 pt-6 border-t border-gray-200">
        Vehicle Registration Checker API — contact your administrator for keys and billing.
      </footer>
    </div>
  )
}
