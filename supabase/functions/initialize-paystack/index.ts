import { corsHeaders, handleOptions } from '../_shared/cors.ts'
import { adminClient, getUser } from '../_shared/auth.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  try {
    const user = await getUser(request)
    const { amountNaira } = await request.json()
    if (!Number.isSafeInteger(amountNaira) || amountNaira < 500) return json({ error: 'Amount must be a whole number of at least ₦500.' }, 400)
    if (!user.email) return json({ error: 'A verified account email is required.' }, 400)
    const reference = `mova_${user.id}_${crypto.randomUUID()}`
    const supabase = adminClient()
    await supabase.from('payments').insert({ reference, user_id: user.id, email: user.email, amount_naira: amountNaira, amount_kobo: amountNaira * 100, status: 'initialized' }).throwOnError()
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, amount: amountNaira * 100, reference, currency: 'NGN' }),
    })
    const result = await response.json()
    if (!response.ok || !result?.status || !result?.data?.authorization_url) {
      await supabase.from('payments').update({ status: 'initialization_failed' }).eq('reference', reference)
      return json({ error: 'Could not initialize Paystack checkout.' }, 502)
    }
    await supabase.from('payments').update({ status: 'pending' }).eq('reference', reference)
    return json({ authorizationUrl: result.data.authorization_url, reference })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Payment initialization failed.' }, 400)
  }
})
