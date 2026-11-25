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
    const inventoryResponse = await fetch(
      `${twilioBase()}/AvailablePhoneNumbers/${countryCode}/Local.json?SmsEnabled=true&PageSize=20`,
      { headers: twilioHeaders() },
    )
    const inventory = await inventoryResponse.json()
    const number = inventory?.available_phone_numbers?.[0]?.phone_number
    if (!inventoryResponse.ok || !number)
      return json({ error: 'No provider inventory is available.' }, 503)
    const { data: orderId, error: reservationError } = await supabase.rpc('reserve_number_order', {
      p_user_id: user.id,
      p_country_code: countryCode,
      p_service: service,
      p_tier: tier,
      p_price_naira: priceNaira,
    })
    if (reservationError) throw reservationError
    const order = { id: orderId }
    const form = new URLSearchParams({
      PhoneNumber: number,
      SmsUrl: Deno.env.get('MOVA_VERIFY_TWILIO_SMS_WEBHOOK_URL') || '',
    })
    const purchaseResponse = await fetch(`${twilioBase()}/IncomingPhoneNumbers.json`, {
      method: 'POST',
      headers: { ...twilioHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const purchased = await purchaseResponse.json()
    if (!purchaseResponse.ok) {
      const { error: refundError } = await supabase.rpc('refund_failed_number_order', {
        p_order_id: order.id,
      })
      if (refundError) throw refundError
      return json({ error: 'Provider allocation failed. Your wallet has been refunded.' }, 503)
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
