import { supabase, supabaseConfigured } from '../lib/supabase.js'

async function callEdgeFunction(name, body) {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase backend is not configured.')
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sign in before using live backend functions.')
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'The backend request failed.')
  return result
}

export async function initializeWalletFunding(amountNaira) {
  return callEdgeFunction('initialize-paystack', { amountNaira })
}

export async function verifyWalletFunding(reference) {
  return callEdgeFunction('verify-paystack', { reference })
}

export async function purchaseLiveNumber({ countryCode, service, tier }) {
  return callEdgeFunction('purchase-number', { countryCode, service, tier })
}
