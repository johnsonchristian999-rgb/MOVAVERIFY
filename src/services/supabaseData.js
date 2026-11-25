import { supabase, supabaseConfigured } from '../lib/supabase.js'

const countryNames = { US: 'United States', GB: 'United Kingdom', CA: 'Canada', DE: 'Germany' }

function requireClient() {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function listUserOrders() {
  const { data, error } = await requireClient()
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((order) => ({
    ...order,
    country: countryNames[order.country_code] || order.country_code,
    amount: order.price_naira,
    time: new Date(order.created_at).toLocaleString(),
    flag: '🌐',
    number: order.phone_number || 'Provider assignment pending',
  }))
}

export async function listCatalog() {
  const { data, error } = await requireClient()
    .from('catalog')
    .select('*')
    .eq('active', true)
    .order('country_code')
  if (error) throw error
  return data
}

export async function listUserMessages() {
  const { data, error } = await requireClient()
    .from('messages')
    .select('*')
    .order('received_at', { ascending: false })
  if (error) throw error
  return data.map((message) => ({
    ...message,
    orderId: message.order_id,
    receivedAt: message.received_at,
  }))
}

export async function getUserWallet() {
  const { data, error } = await requireClient()
    .from('wallets')
    .select('balance_naira')
    .maybeSingle()
  if (error) throw error
  return data || { balance_naira: 0 }
}

export async function listUserTransactions() {
  const { data, error } = await requireClient()
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((item) => ({
    ...item,
    amount: item.amount_naira,
    description: item.reference,
    time: new Date(item.created_at).toLocaleString(),
  }))
}

export async function getUserProfile() {
  const { data, error } = await requireClient().from('profiles').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function updateUserProfile({ displayName }) {
  const client = requireClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error('Sign in before updating your profile.')
  const { data, error } = await client
    .from('profiles')
    .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listUserSupportTickets() {
  const { data, error } = await requireClient()
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createSupportTicket({ topic, subject, details }) {
  const client = requireClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error('Sign in before creating a support ticket.')
  const { data, error } = await client
    .from('support_tickets')
    .insert({ user_id: user.id, topic, subject: subject.trim(), details: details.trim() })
    .select()
    .single()
  if (error) throw error
  return data
}

export function subscribeToUserTable(table, callback) {
  if (!supabaseConfigured || !supabase) return () => {}
  const channel = supabase
    .channel(`${table}-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
