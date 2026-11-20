import { supabase, supabaseConfigured } from '../lib/supabase.js'

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
    country: order.country_code,
    amount: order.price_naira,
    time: new Date(order.created_at).toLocaleString(),
    flag: '🌐',
    number: order.phone_number || 'Provider assignment pending',
  }))
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
