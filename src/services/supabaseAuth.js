import { supabase, supabaseConfigured } from '../lib/supabase.js'

function requireSupabase() {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase Auth is not configured.')
}

export function subscribeToSupabaseAuth(callback) {
  if (!supabaseConfigured || !supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    callback(session?.user || null),
  )
  return () => data.subscription.unsubscribe()
}

export async function registerSupabaseUser({ name, email, password }) {
  requireSupabase()
  if (!name?.trim() || !email?.trim() || password?.length < 10)
    throw new Error(
      'Enter your name, a valid email address, and a password of at least 10 characters.',
    )
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: name.trim() } },
  })
  if (error) throw error
  return data
}

export async function loginSupabaseUser({ email, password }) {
  requireSupabase()
  if (!email?.trim() || !password) throw new Error('Email and password are required.')
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
  return data.user
}

export async function recoverSupabasePassword(email) {
  requireSupabase()
  if (!email?.trim()) throw new Error('Enter the email address for your account.')
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
  if (error) throw error
}

export async function logoutSupabaseUser() {
  requireSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
