import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { createTwilioProvider } from './src/providers/twilio.js'
import { initializePaystackFunding, paystackWebhook, verifyPaystackFunding } from './src/payments/paystack.js'
import { requireString } from './src/validation.js'
import twilio from 'twilio'

initializeApp()
setGlobalOptions({ region: 'us-central1', maxInstances: 10 })
const db = getFirestore()

export { initializePaystackFunding, paystackWebhook, verifyPaystackFunding }

export const purchaseNumber = onCall({ enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to purchase a number.')
  const countryCode = requireString(request.data?.countryCode, 'country code', 2).toUpperCase()
  const service = requireString(request.data?.service, 'service', 40)
  const tier = requireString(request.data?.tier, 'price tier', 20)
  const userId = request.auth.uid
  const catalogRef = db.collection('catalog').doc(countryCode)
  const catalogSnapshot = await catalogRef.get()
  const catalog = catalogSnapshot.data()
  if (!catalogSnapshot.exists || catalog?.active !== true) throw new HttpsError('failed-precondition', 'This country is not enabled for live purchasing.')
  if (!Array.isArray(catalog.services) || !catalog.services.includes(service)) throw new HttpsError('failed-precondition', 'This service is not enabled for this country.')
  const priceNaira = catalog.pricing?.[service]?.[tier]
  if (!Number.isSafeInteger(priceNaira) || priceNaira < 500) throw new HttpsError('failed-precondition', 'This price tier is not configured.')

  const provider = createTwilioProvider()
  if (!provider.isEnabled) throw new HttpsError('failed-precondition', 'Live purchasing is disabled until Twilio approval and server configuration are complete.')
  let available
  try {
    available = await provider.listAvailableNumbers({ countryCode })
  } catch (error) {
    console.error('Provider inventory lookup failed', error.message)
    throw new HttpsError('unavailable', 'Provider inventory could not be verified. No order was placed.')
  }
  if (!available.length) throw new HttpsError('resource-exhausted', 'The provider reports no available numbers for this country.')

  const walletRef = db.collection('wallets').doc(userId)
  const orderRef = db.collection('orders').doc()
  const ledgerRef = db.collection('transactions').doc(orderRef.id)
  await db.runTransaction(async (transaction) => {
    const wallet = await transaction.get(walletRef)
    const balance = wallet.data()?.balanceNaira || 0
    if (balance < priceNaira) throw new HttpsError('failed-precondition', 'Insufficient wallet funds.')
    transaction.update(walletRef, { balanceNaira: balance - priceNaira, updatedAt: FieldValue.serverTimestamp() })
    transaction.create(orderRef, {
      uid: userId, countryCode, service, tier, priceNaira,
      status: 'provisioning', provider: 'twilio', createdAt: FieldValue.serverTimestamp(),
    })
    transaction.create(ledgerRef, {
      uid: userId, type: 'debit', amountNaira: priceNaira, reference: orderRef.id,
      status: 'reserved', createdAt: FieldValue.serverTimestamp(),
    })
  })

  try {
    const purchased = await provider.purchaseNumber({ phoneNumber: available[0].phoneNumber })
    await db.runTransaction(async (transaction) => {
      transaction.update(orderRef, {
        status: 'waiting_for_sms', phoneNumber: purchased.phoneNumber,
        providerSid: purchased.sid, provisionedAt: FieldValue.serverTimestamp(),
      })
      transaction.update(ledgerRef, { status: 'completed' })
    })
    return { orderId: orderRef.id, status: 'waiting_for_sms' }
  } catch (error) {
    console.error('Provider allocation result requires reconciliation', error.message)
    await orderRef.update({ status: 'provider_review', updatedAt: FieldValue.serverTimestamp() })
    await ledgerRef.update({ status: 'provider_review' })
    throw new HttpsError('unavailable', 'Provider allocation needs review. The reserved balance has not been released automatically.')
  }
})

export const twilioSmsWebhook = onRequest(async (request, response) => {
  if (request.method !== 'POST') return response.status(405).send('Method not allowed')
  const provider = createTwilioProvider()
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const webhookUrl = process.env.NUMORA_TWILIO_SMS_WEBHOOK_URL
  const signature = request.get('x-twilio-signature') || ''
  if (!provider.isEnabled || !authToken || !webhookUrl || !twilio.validateRequest(authToken, signature, webhookUrl, request.body || {})) {
    return response.status(403).send('Invalid or disabled webhook')
  }
  const recipient = request.body?.To
  const sender = request.body?.From
  const body = request.body?.Body
  const messageSid = request.body?.MessageSid
  if (![recipient, sender, body, messageSid].every((value) => typeof value === 'string' && value.length > 0)) {
    return response.status(400).send('Invalid message payload')
  }
  const orderQuery = await db.collection('orders').where('phoneNumber', '==', recipient).limit(1).get()
  if (orderQuery.empty) return response.status(204).send('')
  const order = orderQuery.docs[0]
  await db.collection('messages').doc(messageSid).create({
    uid: order.data().uid,
    orderId: order.id,
    from: sender,
    to: recipient,
    body,
    provider: 'twilio',
    receivedAt: FieldValue.serverTimestamp(),
  }).catch((error) => {
    if (error.code !== 6) throw error
  })
  return response.status(200).type('text/xml').send('<Response></Response>')
})
