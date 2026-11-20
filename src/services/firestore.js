import {
  collection,
  onSnapshot,
  orderBy,
  query,
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
