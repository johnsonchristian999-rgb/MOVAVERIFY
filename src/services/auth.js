import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, firebaseConfigured } from '../lib/firebase.js'

function requireAuth() {
  if (!firebaseConfigured || !auth) throw new Error('Firebase Authentication is not configured.')
}

export async function registerUser({ name, email, password }) {
  requireAuth()
  if (!name?.trim() || !email?.trim() || password?.length < 10) {
    throw new Error('Enter your name, a valid email address, and a password of at least 10 characters.')
  }
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
  await updateProfile(credential.user, { displayName: name.trim() })
  return credential.user
}

export async function loginUser({ email, password }) {
  requireAuth()
  if (!email?.trim() || !password) throw new Error('Email and password are required.')
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  return credential.user
}

export async function recoverPassword(email) {
  requireAuth()
  if (!email?.trim()) throw new Error('Enter the email address for your account.')
  await sendPasswordResetEmail(auth, email.trim())
}

export async function logoutUser() {
  requireAuth()
  await signOut(auth)
}
