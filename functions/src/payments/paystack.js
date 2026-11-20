import crypto from 'node:crypto'
import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { requireAmount, requireString, constantTimeEqual } from '../validation.js'

const paystackSecret = defineSecret('PAYSTACK_SECRET_KEY')
const db = getFirestore()

export const initializePaystackFunding = onCall({ secrets: [paystackSecret], enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to fund your wallet.')
  const amountNaira = requireAmount(request.data?.amountNaira)
  const amountKobo = amountNaira * 100
  const reference = `numora_${request.auth.uid}_${crypto.randomUUID()}`
  const paymentRef = db.collection('payments').doc(reference)
  const email = request.auth.token.email
  if (typeof email !== 'string' || !email.includes('@')) throw new HttpsError('failed-precondition', 'A verified account email is required.')
  await paymentRef.create({ uid: request.auth.uid, email, amountNaira, amountKobo, status: 'initialized', createdAt: FieldValue.serverTimestamp() })

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${paystackSecret.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, amount: amountKobo, reference, currency: 'NGN' }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.status || !result?.data?.authorization_url) {
    await paymentRef.update({ status: 'initialization_failed', failedAt: FieldValue.serverTimestamp() })
    throw new HttpsError('unavailable', 'Could not initialize Paystack checkout.')
  }
  await paymentRef.update({ status: 'pending', accessCode: result.data.access_code })
  return { authorizationUrl: result.data.authorization_url, reference }
})

async function verifyAndCredit(reference, uidFromRequest) {
  const ref = requireString(reference, 'reference', 160)
  const paymentRef = db.collection('payments').doc(ref)
  const payment = await paymentRef.get()
  if (!payment.exists) throw new HttpsError('not-found', 'Payment reference not found.')
  const data = payment.data()
  if (uidFromRequest && data.uid !== uidFromRequest) throw new HttpsError('permission-denied', 'Payment does not belong to this user.')
  if (data.status === 'success') return { credited: false, status: 'success' }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${paystackSecret.value()}` },
  })
  const result = await response.json().catch(() => null)
  const verified = response.ok && result?.status && result?.data?.status === 'success'
    && result.data.reference === ref
    && result.data.amount === data.amountKobo
    && result.data.currency === 'NGN'
    && result.data.customer?.email === data.email
  if (!verified) {
    await paymentRef.update({ status: 'failed', verifiedAt: FieldValue.serverTimestamp() })
    throw new HttpsError('failed-precondition', 'Payment could not be verified.')
  }

  await db.runTransaction(async (transaction) => {
    const freshPayment = await transaction.get(paymentRef)
    if (freshPayment.data()?.status === 'success') return
    const walletRef = db.collection('wallets').doc(data.uid)
    const wallet = await transaction.get(walletRef)
    transaction.set(walletRef, {
      balanceNaira: (wallet.data()?.balanceNaira || 0) + data.amountNaira,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    transaction.update(paymentRef, { status: 'success', creditedAt: FieldValue.serverTimestamp(), paystackTransactionId: result.data.id })
    transaction.create(db.collection('transactions').doc(ref), {
      uid: data.uid, type: 'credit', amountNaira: data.amountNaira, reference: ref,
      status: 'success', createdAt: FieldValue.serverTimestamp(),
    })
  })
  return { credited: true, status: 'success' }
}

export const verifyPaystackFunding = onCall({ secrets: [paystackSecret], enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to verify this payment.')
  return verifyAndCredit(request.data?.reference, request.auth.uid)
})

export const paystackWebhook = onRequest({ secrets: [paystackSecret] }, async (request, response) => {
  if (request.method !== 'POST') return response.status(405).send('Method not allowed')
  const received = request.get('x-paystack-signature') || ''
  const expected = crypto.createHmac('sha512', paystackSecret.value()).update(request.rawBody).digest('hex')
  if (!constantTimeEqual(received, expected)) return response.status(401).send('Invalid signature')
  if (request.body?.event === 'charge.success') {
    try {
      await verifyAndCredit(request.body.data?.reference)
    } catch (error) {
      console.error('Paystack webhook verification failed', error.message)
      return response.status(400).send('Payment verification failed')
    }
  }
  return response.status(200).send('ok')
})
