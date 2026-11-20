import { corsHeaders, handleOptions } from '../_shared/cors.ts'
import { adminClient, getUser } from '../_shared/auth.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
const twilioBase = () =>
  `https://api.twilio.com/2010-04-01/Accounts/${Deno.env.get('TWILIO_ACCOUNT_SID')}`
const twilioHeaders = () => ({
  Authorization: `Basic ${btoa(`${Deno.env.get('TWILIO_ACCOUNT_SID')}:${Deno.env.get('TWILIO_AUTH_TOKEN')}`)}`,
})

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  try {
    const user = await getUser(request)
    if (Deno.env.get('TWILIO_RESALE_APPROVED') !== 'true')
      return json(
        { error: 'Live purchasing is disabled until provider approval is complete.' },
        412,
      )
    const { countryCode, service, tier } = await request.json()
    if (!/^[A-Z]{2}$/.test(countryCode) || typeof service !== 'string' || typeof tier !== 'string')
      return json({ error: 'Invalid purchase selection.' }, 400)
    const supabase = adminClient()
    const { data: catalog } = await supabase
      .from('catalog')
      .select('*')
      .eq('country_code', countryCode)
      .eq('active', true)
      .maybeSingle()
    const priceNaira = catalog?.pricing?.[service]?.[tier]
    if (!catalog || !Number.isSafeInteger(priceNaira) || priceNaira < 500)
      return json({ error: 'This service or price tier is unavailable.' }, 412)
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance_naira')
      .eq('user_id', user.id)
      .maybeSingle()
    if ((wallet?.balance_naira || 0) < priceNaira)
      return json({ error: 'Insufficient wallet funds.' }, 412)
    const inventoryResponse = await fetch(
      `${twilioBase()}/AvailablePhoneNumbers/${countryCode}/Local.json?SmsEnabled=true&PageSize=20`,
      { headers: twilioHeaders() },
    )
    const inventory = await inventoryResponse.json()
    const number = inventory?.available_phone_numbers?.[0]?.phone_number
    if (!inventoryResponse.ok || !number)
      return json({ error: 'No provider inventory is available.' }, 503)
    const order = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        country_code: countryCode,
        service,
        tier,
        price_naira: priceNaira,
        status: 'provisioning',
      })
      .select('id')
      .single()
      .then(({ data, error }) => {
        if (error) throw error
        return data
      })
    await supabase
      .from('wallets')
      .upsert({
        user_id: user.id,
        balance_naira: (wallet?.balance_naira || 0) - priceNaira,
        updated_at: new Date().toISOString(),
      })
    await supabase
      .from('transactions')
      .insert({
        id: order.id,
        user_id: user.id,
        type: 'debit',
        amount_naira: priceNaira,
        reference: order.id,
        status: 'reserved',
      })
    const form = new URLSearchParams({
      PhoneNumber: number,
      SmsUrl: Deno.env.get('NUMORA_TWILIO_SMS_WEBHOOK_URL') || '',
    })
    const purchaseResponse = await fetch(`${twilioBase()}/IncomingPhoneNumbers.json`, {
      method: 'POST',
      headers: { ...twilioHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const purchased = await purchaseResponse.json()
    if (!purchaseResponse.ok) {
      await supabase.from('orders').update({ status: 'provider_review' }).eq('id', order.id)
      await supabase.from('transactions').update({ status: 'provider_review' }).eq('id', order.id)
      return json({ error: 'Provider allocation needs review.', orderId: order.id }, 503)
    }
    await supabase
      .from('orders')
      .update({
        status: 'waiting_for_sms',
        phone_number: purchased.phone_number,
        provider_sid: purchased.sid,
        provisioned_at: new Date().toISOString(),
      })
      .eq('id', order.id)
    await supabase.from('transactions').update({ status: 'completed' }).eq('id', order.id)
    return json({ orderId: order.id, status: 'waiting_for_sms' })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Purchase failed.' }, 400)
  }
})
