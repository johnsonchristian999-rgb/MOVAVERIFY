import { corsHeaders, handleOptions } from '../_shared/cors.ts'
import { adminClient, getUser } from '../_shared/auth.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  try {
    const user = await getUser(request)
    const { reference } = await request.json()
    if (typeof reference !== 'string' || reference.length < 8 || reference.length > 160)
      return json({ error: 'Invalid payment reference.' }, 400)
    const supabase = adminClient()
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('reference', reference)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!payment) return json({ error: 'Payment reference not found.' }, 404)
    if (payment.status === 'success') return json({ credited: false, status: 'success' })
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` } },
    )
    const result = await response.json()
    const verified =
      response.ok &&
      result?.status &&
      result?.data?.status === 'success' &&
      result.data.reference === reference &&
      result.data.amount === payment.amount_kobo &&
      result.data.currency === 'NGN' &&
      result.data.customer?.email === payment.email
    if (!verified) {
      return json({ error: 'Payment could not be verified.' }, 400)
    }
    const { data: credited, error } = await supabase.rpc('credit_verified_payment', {
      p_reference: reference,
    })
    if (error) throw error
    return json({ credited, status: 'success' })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Payment verification failed.' },
      400,
    )
  }
})
