import { corsHeaders } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'

async function validSignature(request: Request, rawBody: string) {
  const signature = request.headers.get('x-twilio-signature') || ''
  const url = Deno.env.get('NUMORA_TWILIO_SMS_WEBHOOK_URL') || ''
  const params = new URLSearchParams(rawBody)
  const canonical =
    url +
    [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}${value}`)
      .join('')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(Deno.env.get('TWILIO_AUTH_TOKEN') || ''),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical))
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
  return signature === expected
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const rawBody = await request.text()
  if (
    Deno.env.get('TWILIO_RESALE_APPROVED') !== 'true' ||
    !(await validSignature(request, rawBody))
  )
    return new Response('Invalid or disabled webhook', { status: 403 })
  const body = new URLSearchParams(rawBody)
  const recipient = body.get('To')
  const sender = body.get('From')
  const message = body.get('Body')
  const sid = body.get('MessageSid')
  if (!recipient || !sender || !message || !sid)
    return new Response('Invalid message payload', { status: 400 })
  const supabase = adminClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id,user_id')
    .eq('phone_number', recipient)
    .limit(1)
    .maybeSingle()
  if (order)
    await supabase
      .from('messages')
      .upsert({
        id: sid,
        user_id: order.user_id,
        order_id: order.id,
        sender,
        recipient,
        body: message,
      })
  return new Response('<Response></Response>', {
    headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
  })
})
