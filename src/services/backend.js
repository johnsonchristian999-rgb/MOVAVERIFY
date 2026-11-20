import { httpsCallable } from 'firebase/functions'
import { functions, firebaseConfigured } from '../lib/firebase.js'

function callable(name) {
  if (!firebaseConfigured || !functions) {
    throw new Error(
      'Live backend functions are not configured. Continue in demo mode or configure Firebase first.',
    )
  }
  return httpsCallable(functions, name)
}

export async function initializeWalletFunding(amountNaira) {
  const result = await callable('initializePaystackFunding')({ amountNaira })
  return result.data
}

export async function verifyWalletFunding(reference) {
  const result = await callable('verifyPaystackFunding')({ reference })
  return result.data
}

export async function purchaseLiveNumber({ countryCode, service, tier }) {
  const result = await callable('purchaseNumber')({
    countryCode,
    service,
    tier,
  })
  return result.data
}
