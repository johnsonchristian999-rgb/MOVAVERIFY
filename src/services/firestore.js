import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db, firebaseConfigured } from '../lib/firebase.js'

export function subscribeToUserMessages(uid, onMessages, onError) {
  if (!firebaseConfigured || !db || !uid) {
    onError?.(new Error('Live SMS Inbox requires Firebase configuration and an authenticated user.'))
    return () => {}
  }
  const messagesQuery = query(
    collection(db, 'messages'),
    where('uid', '==', uid),
    orderBy('receivedAt', 'desc'),
  )
  return onSnapshot(messagesQuery, (snapshot) => {
    onMessages(snapshot.docs.map((message) => ({ id: message.id, ...message.data() })))
  }, onError)
}

export async function createUserProfile(user, displayName) {
  if (!firebaseConfigured || !db || !user?.uid) throw new Error('Live profile storage requires Firebase configuration and an authenticated user.')
  await setDoc(doc(db, 'users', user.uid), {
    displayName: displayName?.trim() || user.displayName || 'Mova Verify User',
    email: user.email || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function subscribeToUserOrders(uid, onOrders, onError) {
  if (!firebaseConfigured || !db || !uid) {
    onError?.(new Error('Live orders require Firebase configuration and an authenticated user.'))
    return () => {}
  }
  const ordersQuery = query(
    collection(db, 'orders'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(ordersQuery, (snapshot) => {
    onOrders(snapshot.docs.map((order) => ({ id: order.id, ...order.data() })))
  }, onError)
}
