import { adminClient } from '../_shared/auth.ts'

async function validSignature(request: Request, rawBody: string) {
  const signature = request.headers.get('x-paystack-signature') || ''
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(Deno.env.get('PAYSTACK_SECRET_KEY') || ''),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return signature === expected
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const rawBody = await request.text()
  if (!(await validSignature(request, rawBody)))
    return new Response('Invalid signature', { status: 401 })
  const payload = JSON.parse(rawBody)
  if (payload.event !== 'charge.success') return new Response('ok')
  const reference = payload.data?.reference
  if (typeof reference !== 'string')
    return new Response('Invalid payment reference', { status: 400 })
  const supabase = adminClient()
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle()
  if (!payment || payment.status === 'success') return new Response('ok')
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` } },
  )
  const result = await response.json()
  const valid =
    response.ok &&
    result?.status &&
    result?.data?.status === 'success' &&
    result.data.reference === reference &&
    result.data.amount === payment.amount_kobo &&
    result.data.currency === 'NGN' &&
    result.data.customer?.email === payment.email
  if (!valid) return new Response('Payment verification failed', { status: 400 })
  const { error } = await supabase.rpc('credit_verified_payment', { p_reference: reference })
  if (error) return new Response('Unable to credit payment', { status: 500 })
  return new Response('ok')
})
